//frontend/src/pages/ProviderHolidaySettings.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

import { getEstablishmentById, updateEstablishment } from '../services/establishmentService';
import { seedHolidays, getHolidays } from '../services/calendarService';

const countryOptions = [
  { code: 'ES', name: 'España' },
  // añade más si lo necesitas
];

// Algunas subdivisiones frecuentes (Nager usa códigos tipo "ES-VC")
const regionOptionsByCountry = {
  ES: [
    { code: 'ES-AN', name: 'Andalucía' },
    { code: 'ES-AR', name: 'Aragón' },
    { code: 'ES-AS', name: 'Asturias' },
    { code: 'ES-CN', name: 'Canarias' },
    { code: 'ES-CB', name: 'Cantabria' },
    { code: 'ES-CL', name: 'Castilla y León' },
    { code: 'ES-CM', name: 'Castilla-La Mancha' },
    { code: 'ES-CT', name: 'Cataluña' },
    { code: 'ES-EX', name: 'Extremadura' },
    { code: 'ES-GA', name: 'Galicia' },
    { code: 'ES-IB', name: 'Islas Baleares' },
    { code: 'ES-RI', name: 'La Rioja' },
    { code: 'ES-MD', name: 'Madrid' },
    { code: 'ES-MC', name: 'Murcia' },
    { code: 'ES-NC', name: 'Navarra' },
    { code: 'ES-PV', name: 'País Vasco' },
    { code: 'ES-VC', name: 'Comunitat Valenciana' },
    { code: 'ES-CE', name: 'Ceuta' },
    { code: 'ES-ML', name: 'Melilla' },
  ],
};

const typeOptions = [
  { code: 'Public', label: 'Público' },
  { code: 'Bank',   label: 'Bancario' },
  { code: 'School', label: 'Escolar' },
  { code: 'Optional', label: 'Opcional' },
  { code: 'Observance', label: 'Conmemorativo' },
];

const yearAheadOptions = [
  { value: 0, label: 'Sólo año actual' },
  { value: 1, label: 'Año actual + 1' },
  { value: 2, label: 'Año actual + 2' },
  { value: 3, label: 'Año actual + 3' },
];

const toDateTime = (iso) => {
  try { return new Date(iso).toLocaleString(); } catch { return iso || '—'; }
};

export default function ProviderHolidaySettings() {
  const [searchParams] = useSearchParams();
  const establishmentId = searchParams.get('est_id');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Datos del establecimiento
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [country, setCountry]         = useState('ES');
  const [region, setRegion]           = useState('');
  const [types, setTypes]             = useState(['Public', 'Bank']);
  const [yearsAhead, setYearsAhead]   = useState(1);
  const [lastSeedYear, setLastSeedYear] = useState(null);
  const [lastSyncAt, setLastSyncAt]     = useState(null);
  const [estName, setEstName] = useState('');

  // Preview de festivos
  const [previewYear, setPreviewYear] = useState(new Date().getFullYear());
  const [preview, setPreview] = useState([]);

  const regions = useMemo(() => regionOptionsByCountry[country] || [], [country]);

  useEffect(() => {
    const load = async () => {
      if (!establishmentId) {
        toast.error('Falta est_id en la URL');
        return;
      }
      setLoading(true);
      try {
        const est = await getEstablishmentById(establishmentId);
        setEstName(est?.nombre || '');
        setAutoEnabled(!!est?.holiday_auto_enabled);
        setCountry(est?.holiday_country_code || 'ES');
        setRegion(est?.holiday_region_code || '');
        setYearsAhead(typeof est?.holiday_years_ahead === 'number' ? est.holiday_years_ahead : 1);

        // types almacenado como CSV
        const csv = est?.holiday_types || 'Public,Bank';
        setTypes(csv.split(',').filter(Boolean));

        setLastSeedYear(est?.holiday_last_seed_year || null);
        setLastSyncAt(est?.holiday_last_sync_at || null);
      } catch (e) {
        console.error(e);
        toast.error('No se pudieron cargar los ajustes.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [establishmentId]);

  const handleSave = async () => {
    if (!establishmentId) return;
    setSaving(true);
    try {
      await updateEstablishment(Number(establishmentId), {
        holiday_auto_enabled: !!autoEnabled,
        holiday_country_code: country || 'ES',
        holiday_region_code: region || null,
        holiday_types: types.join(','),  // CSV
        holiday_years_ahead: Number(yearsAhead),
      });
      toast.success('Preferencias guardadas.');
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.msg || 'No se pudieron guardar los ajustes.');
    } finally {
      setSaving(false);
    }
  };

  const handleSeedNow = async () => {
    if (!establishmentId) return;
    setSeeding(true);
    try {
      const res = await seedHolidays({
        establishmentId,
        country,
        region: region || undefined,
        year: previewYear,
        types: types.join(','),
        category: 'holiday',
      });
      const { inserted = 0, skipped = 0 } = res || {};
      toast.success(`Siembra realizada. Insertados: ${inserted}. Omitidos: ${skipped}.`);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.msg || 'No se pudo sembrar festivos.');
    } finally {
      setSeeding(false);
    }
  };

  const loadPreview = async () => {
    setPreviewLoading(true);
    try {
      const data = await getHolidays({
        country,
        region: region || undefined,
        year: previewYear,
      });
      setPreview(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo cargar la vista previa de festivos.');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    // carga una primera vista previa al entrar
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, region, previewYear]);

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Ajustes de Festivos</h1>
        {estName && <p className="text-sm text-gray-600">Establecimiento: <strong>{estName}</strong></p>}
      </header>

      <div className="space-y-6">
        <Card>
          {loading ? (
            <p>Cargando…</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  id="auto-enabled"
                  type="checkbox"
                  checked={autoEnabled}
                  onChange={(e) => setAutoEnabled(e.target.checked)}
                />
                <label htmlFor="auto-enabled" className="select-none">
                  Activar siembra automática de festivos para este establecimiento
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-600">País</label>
                  <select
                    value={country}
                    onChange={(e) => { setCountry(e.target.value); setRegion(''); }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {countryOptions.map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-600">Región / Comunidad (opcional)</label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">— Sin región (festivos nacionales) —</option>
                    {regions.map(r => (
                      <option key={r.code} value={r.code}>{r.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Si se indica región, sólo se sembrarán los festivos aplicables a esa región.
                  </p>
                </div>

                <div>
                  <label className="text-xs text-gray-600">Años por delante</label>
                  <select
                    value={yearsAhead}
                    onChange={(e) => setYearsAhead(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {yearAheadOptions.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-600">Tipos de festivo (Nager)</label>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {typeOptions.map(t => {
                      const checked = types.includes(t.code);
                      const toggle = () =>
                        setTypes(prev => checked ? prev.filter(x => x !== t.code) : [...prev, t.code]);
                      return (
                        <label key={t.code} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={checked} onChange={toggle} />
                          {t.label} <span className="text-gray-400 text-xs">({t.code})</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Se usarán para la siembra automática y manual (proxy/cron).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar preferencias'}
                </Button>
                <div className="text-sm text-gray-500">
                  Últ. siembra: <strong>{lastSeedYear ?? '—'}</strong> · Últ. sync:{' '}
                  <strong>{lastSyncAt ? toDateTime(lastSyncAt) : '—'}</strong>
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-3">Vista previa & siembra manual</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-600">Año</label>
              <input
                type="number"
                min="2020"
                max="2100"
                value={previewYear}
                onChange={(e) => setPreviewYear(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={loadPreview} disabled={previewLoading}>
                {previewLoading ? 'Cargando…' : 'Refrescar vista previa'}
              </Button>
              <Button onClick={handleSeedNow} disabled={seeding}>
                {seeding ? 'Sembrando…' : 'Sembrar festivos (año elegido)'}
              </Button>
            </div>
          </div>

          <div className="mt-4">
            {previewLoading ? (
              <p>Cargando vista previa…</p>
            ) : preview.length === 0 ? (
              <p className="text-sm text-gray-500">No hay festivos para los filtros elegidos.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {preview.map((h, idx) => (
                  <li key={`${h.date}-${idx}`} className="py-2">
                    <div className="text-sm">
                      <strong>{h.date}</strong> — {h.localName || h.name}
                    </div>
                    {h.counties && (
                      <div className="text-xs text-gray-500">
                        Ámbitos: {Array.isArray(h.counties) ? h.counties.join(', ') : String(h.counties)}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      Tipos: {Array.isArray(h.types) ? h.types.join(', ') : String(h.types)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-2">Consejos</h3>
          <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
            <li>La siembra manual crea <em>blackouts</em> de día completo (idempotente).</li>
            <li>El cron interno poblará los años desde el actual hasta el límite configurado en “Años por delante”.</li>
            <li>Los <em>blackouts</em> se muestran en la Agenda como “background events” grises.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
