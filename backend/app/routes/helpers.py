# backend/app/routes/helpers.py
from datetime import date, datetime, time, timedelta, timezone
from flask import current_app
from app import db
from app.models import AvailabilityRule, TimeBlock

VALID_DAYS_OF_WEEK = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']
PYTHON_WEEKDAY_TO_ENUM_STR = {0: 'LUNES', 1: 'MARTES', 2: 'MIERCOLES', 3: 'JUEVES', 4: 'VIERNES', 5: 'SABADO', 6: 'DOMINGO'}

def merge_overlapping_intervals(intervals: list[dict[str, datetime]]) -> list[dict[str, datetime]]:
    """
    Fusiona una lista de intervalos de tiempo que pueden estar solapados o ser adyacentes.
    Cada intervalo es un diccionario {'start': datetime_utc, 'end': datetime_utc}.
    Devuelve una nueva lista de intervalos no solapados, ordenados por inicio.
    """
    if not intervals:
        return []

    intervals.sort(key=lambda x: x['start'])
    merged = []
    if not intervals: 
        return merged

    current_start = intervals[0]['start']
    current_end = intervals[0]['end']

    for i in range(1, len(intervals)):
        next_start = intervals[i]['start']
        next_end = intervals[i]['end']

        if next_start <= current_end: 
            current_end = max(current_end, next_end)
        else:
            merged.append({'start': current_start, 'end': current_end})
            current_start = next_start
            current_end = next_end
    
    merged.append({'start': current_start, 'end': current_end})
    return merged

def get_provider_timezone_object(provider_timezone_str: str) -> timezone | None:
    """
    Intenta obtener un objeto tzinfo a partir de un string de zona horaria.
    Prioriza zoneinfo, luego pytz, y finalmente un fallback para 'UTC'.
    """
    provider_tz = None
    module_name = "get_provider_timezone_object"

    try:
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
        try:
            provider_tz = ZoneInfo(provider_timezone_str)
            current_app.logger.debug(f"{module_name}: Timezone '{provider_timezone_str}' obtenida con zoneinfo.")
            return provider_tz
        except ZoneInfoNotFoundError:
            current_app.logger.warning(f"{module_name}: ZoneInfo no encontró la zona horaria: '{provider_timezone_str}'. Intentando con pytz.")
        except Exception as e_zi:
            current_app.logger.error(f"{module_name}: Error inesperado con ZoneInfo para '{provider_timezone_str}': {e_zi}")
    except ImportError:
        pass  # ZoneInfo no disponible (Python < 3.9)
    
    try:
        import pytz
        try:
            provider_tz = pytz.timezone(provider_timezone_str)
            current_app.logger.debug(f"{module_name}: Timezone '{provider_timezone_str}' obtenida con pytz.")
            return provider_tz
        except pytz.UnknownTimeZoneError:
            current_app.logger.error(f"{module_name}: Zona horaria desconocida '{provider_timezone_str}' con pytz.")
        except Exception as e_pytz:
            current_app.logger.error(f"{module_name}: Error inesperado con pytz para '{provider_timezone_str}': {e_pytz}")
    except ImportError:
        pass  # pytz no está instalado

    if provider_timezone_str and provider_timezone_str.upper() == 'UTC':
        current_app.logger.warning(f"{module_name}: Usando datetime.timezone.utc como fallback para 'UTC'.")
        return timezone.utc
        
    current_app.logger.error(f"{module_name}: No se pudo obtener el objeto timezone para '{provider_timezone_str}'.")
    return None

def calculate_daily_net_working_periods(provider_id: int, target_date: date, provider_tz_obj: timezone) -> list[dict[str, datetime]]:
    """
    Calcula los periodos de trabajo netos (en UTC) para un proveedor en una fecha específica,
    considerando AvailabilityRules y TimeBlocks.

    Args:
        provider_id: El ID del proveedor (de la tabla Provider, que es user_id).
        target_date: La fecha local del proveedor para la cual calcular la disponibilidad.
        provider_tz_obj: El objeto timezone (tzinfo) del proveedor ya resuelto.

    Returns:
        Una lista de diccionarios {'start': datetime_utc, 'end': datetime_utc}
        representando los periodos de trabajo netos fusionados, o una lista vacía si no hay disponibilidad.
    """
    module_name = "calculate_daily_net_working_periods"
    current_app.logger.debug(f"{module_name}: Iniciando para Provider ID {provider_id}, Fecha {target_date}, TZ {provider_tz_obj}")

    day_of_week_enum_value = PYTHON_WEEKDAY_TO_ENUM_STR.get(target_date.weekday())
    base_availability_intervals_utc = []

    if day_of_week_enum_value:
        rules_for_day = AvailabilityRule.query.filter_by(
            provider_id=provider_id,
            day_of_week=day_of_week_enum_value
        ).all()
        current_app.logger.debug(f"{module_name}: {len(rules_for_day)} reglas de disponibilidad para {day_of_week_enum_value} el {target_date}.")
        for rule in rules_for_day:
            start_dt_naive = datetime.combine(target_date, rule.start_time)
            end_dt_naive = datetime.combine(target_date, rule.end_time)
            
            # Convertir naive datetime a aware datetime usando la zona horaria del proveedor
            if hasattr(provider_tz_obj, 'localize'):
                start_dt_aware = provider_tz_obj.localize(start_dt_naive)
                end_dt_aware = provider_tz_obj.localize(end_dt_naive)
            else:
                start_dt_aware = start_dt_naive.replace(tzinfo=provider_tz_obj)
                end_dt_aware = end_dt_naive.replace(tzinfo=provider_tz_obj)
            
            base_availability_intervals_utc.append({
                'start': start_dt_aware.astimezone(timezone.utc),
                'end': end_dt_aware.astimezone(timezone.utc)
            })
    else:
        current_app.logger.error(f"{module_name}: No se pudo determinar el día de la semana válido para {target_date}")
        return []

    # Calcular inicio y fin del día (target_date) en UTC para filtrar TimeBlocks
    day_start_local_naive = datetime.combine(target_date, time.min)
    day_start_aware_provider_tz = provider_tz_obj.localize(day_start_local_naive) if hasattr(provider_tz_obj, 'localize') else day_start_local_naive.replace(tzinfo=provider_tz_obj)
    day_start_utc = day_start_aware_provider_tz.astimezone(timezone.utc)
    next_day_start_utc = (day_start_aware_provider_tz + timedelta(days=1)).astimezone(timezone.utc)

    time_blocks_for_day = TimeBlock.query.filter(
        TimeBlock.provider_id == provider_id,
        TimeBlock.start_datetime < next_day_start_utc,
        TimeBlock.end_datetime > day_start_utc
    ).order_by(TimeBlock.start_datetime).all()
    current_app.logger.debug(f"{module_name}: {len(time_blocks_for_day)} TimeBlocks encontrados solapados con {target_date} para Provider ID {provider_id}.")

    processed_intervals_utc = list(base_availability_intervals_utc)

    # Aplicar TimeBlocks que son is_available=False (bloqueos)
    for tb in time_blocks_for_day:
        if not tb.is_available:
            tb_start_utc = tb.start_datetime.astimezone(timezone.utc)
            tb_end_utc = tb.end_datetime.astimezone(timezone.utc)
            current_app.logger.debug(f"{module_name}: Aplicando TimeBlock NO disponible ID {tb.id}: {tb_start_utc.isoformat()} - {tb_end_utc.isoformat()}")
            
            next_processed_intervals = []
            for interval in processed_intervals_utc:
                if tb_end_utc <= interval['start'] or tb_start_utc >= interval['end']:
                    next_processed_intervals.append(interval)
                    continue
                if tb_start_utc <= interval['start'] and tb_end_utc < interval['end']:
                    if tb_end_utc < interval['end']:
                        next_processed_intervals.append({'start': tb_end_utc, 'end': interval['end']})
                elif interval['start'] < tb_start_utc and tb_end_utc >= interval['end']:
                    if interval['start'] < tb_start_utc:
                        next_processed_intervals.append({'start': interval['start'], 'end': tb_start_utc})
                elif interval['start'] < tb_start_utc and tb_end_utc < interval['end']:
                    if interval['start'] < tb_start_utc:
                        next_processed_intervals.append({'start': interval['start'], 'end': tb_start_utc})
                    if tb_end_utc < interval['end']:
                        next_processed_intervals.append({'start': tb_end_utc, 'end': interval['end']})
                elif tb_start_utc <= interval['start'] and tb_end_utc >= interval['end']:
                    pass
                else:
                    current_app.logger.warning(f"{module_name}: TimeBlock (is_available=False) ID {tb.id} ({tb_start_utc}-{tb_end_utc}) tuvo un solapamiento no estándar con el intervalo {interval}. El intervalo original no se añade.")
            processed_intervals_utc = next_processed_intervals
    
    # Aplicar TimeBlocks que son is_available=True (disponibilidad extra)
    extra_availability_utc = []
    for tb in time_blocks_for_day:
        if tb.is_available:
            tb_start_utc = tb.start_datetime.astimezone(timezone.utc)
            tb_end_utc = tb.end_datetime.astimezone(timezone.utc)
            effective_start = max(tb_start_utc, day_start_utc)
            effective_end = min(tb_end_utc, next_day_start_utc)
            if effective_start < effective_end:
                current_app.logger.debug(f"{module_name}: Añadiendo TimeBlock disponible ID {tb.id}: UTC {effective_start.isoformat()} - {effective_end.isoformat()}")
                extra_availability_utc.append({'start': effective_start, 'end': effective_end})

    combined_intervals_utc = processed_intervals_utc + extra_availability_utc
    net_working_periods_utc = merge_overlapping_intervals(combined_intervals_utc)
    
    current_app.logger.debug(f"{module_name}: Para Provider ID {provider_id}, Fecha {target_date}, Periodos netos finales calculados: {net_working_periods_utc}")
    return net_working_periods_utc