// frontend/src/pages/ProviderHolidaySettings.jsx
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { getEstablishmentPrivate, updateEstablishmentPrivate } from '../services/establishmentService';
import { seedHolidays } from '../services/calendarService';

const parseTypes = (s) => (s ? s.split(',').map(t => t.trim()).filter(Boolean) : []);
const typesToString = (arr) => (arr && arr.length ? arr.join(',') : '');

const ProviderHolidaySettings = () => {
  const [searchParams] = useSearchParams();
  const establishmentId = searchParams.get('est_id');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [country, setCountry] = useState('ES');
  const [region, setRegion] = useState(''); // ej: ES-VC
  const [types, setTypes] = useState(['Public', 'Bank']);
  const [yearsAhead, setYearsAhead] = useState(1);
  const [lastSeedYear, setLastSeedYear] = useState(null);
  const [lastSyncAt, setLastSyncAt] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (!establishmentId) return;
      setLoading(true);
      try {
        const est = await getEstablishmentPrivate(establishmentId);
        setEnabled(!!est.holiday_auto_enabled);
        setCountry(est.holiday_country_code || 'ES');
        setRegion(est.holiday_region_code || '');
        setTypes(parseTypes(est.holiday_types || 'Public,Bank'));
        setYearsAhead(est.holiday_years_ahead ?? 1);
        setLastSeedYear(est.holiday_last_seed_year ?? null);
        setLastSyncAt(est.holiday_last_sync_at ?? null);
      } catch (e) {
        toast.error(e?.response?.data?.msg || 'No se pudo cargar la configuración.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [establishmentId]);

  const toggleType = (t) => {
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const onSave = async () => {
    if (!establishmentId) return;
    setSaving(true);
    try {
      const payload = {
        holiday_auto_enabled: !!enabled,
        holiday_country_code: country || 'ES',
        holiday_region_code: region || null,
        holiday_types: typesToString(types.length ? types : ['Public','Bank']),
        holiday_years_ahead: Number(yearsAhead) || 1,
      };
      const est = await updateEstablishmentPrivate(establishmentId, payload);
      setLastSeedYear(est.holiday_last_seed_year ?? null);
      setLastSyncAt(est.holiday_last_sync_at ?? null);
      toast.success('Configuración guardada.');
    } catch (e) {
      toast.error(e?.response?.data?.msg || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const onSeedNow = async () => {
    if (!establishmentId) return;
    setSeeding(true);
    try {
      const year = new Date().getUTCFullYear();
      const res = await seedHolidays({
        establishmentId,
        country,
        region: region || undefined,
        types: typesToString(types),
        year,
      });
      toast.success(`Sembrado: +${res.inserted}, duplicados: ${res.skipped}`);
      // refrescar metadatos
      const est = await getEstablishmentPrivate(establishmentId);
      setLastSeedYear(est.holiday_last_seed_year ?? null);
      setLastSyncAt(est.holiday_last_sync_at ?? null);
    } catch (e) {
      toast.error(e?.response?.data?.msg || 'No se pudo sembrar festivos.');
    } finally {
      setSeeding(false);
    }
  };

  if (loading) return <div className="page-wrapper"><p>Cargando…</p></div>;

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Ajustes de Festivos Automáticos</h1>
        <p className="text-gray-600">Configura cómo bloquear automáticamente los festivos en tu agenda.</p>
      </header>

      <div className="space-y-6">
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={enabled} onChange={(e)=>setEnabled(e.target.checked)} />
              <span>Activar festivos automáticos</span>
            </label>

            <div>
              <label className="text-xs text-gray-600">País</label>
              <select value={country} onChange={(e)=>setCountry(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm">
                <option value="ES">España (ES)</option>
                {/* añade más países según soporte */}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-600">Región (opcional)</label>
              <input
                type="text"
                placeholder="ES-VC"
                value={region}
                onChange={(e)=>setRegion(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Ej: ES-VC (Comunitat Valenciana). Déjalo vacío para festivos nacionales.</p>
            </div>

            <div>
              <label className="text-xs text-gray-600 block mb-1">Tipos de festivo</label>
              <div className="flex gap-4">
                {['Public','Bank'].map(t => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={types.includes(t)} onChange={()=>toggleType(t)} />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600">Años por adelantado</label>
              <select value={yearsAhead} onChange={(e)=>setYearsAhead(Number(e.target.value))} className="w-full rounded-lg border px-3 py-2 text-sm">
                <option value={1}>1 año</option>
                <option value={2}>2 años</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <Button onClick={onSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
            <Button variant="secondary" onClick={onSeedNow} disabled={seeding || !enabled}>
              {seeding ? 'Sembrando…' : 'Sembrar ahora'}
            </Button>
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-gray-900">Estado</h3>
          <div className="text-sm text-gray-700 mt-2">
            <div>Último año sembrado: <strong>{lastSeedYear ?? '—'}</strong></div>
            <div>Última sincronización: <strong>{lastSyncAt ? new Date(lastSyncAt).toLocaleString() : '—'}</strong></div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ProviderHolidaySettings;
