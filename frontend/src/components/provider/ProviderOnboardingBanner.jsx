// frontend/src/components/provider/ProviderOnboardingBanner.jsx
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProviderOnboardingBanner() {
  const { me } = useAuth();
  const ob = me?.onboarding;

  // Mostrar solo a proveedores con onboarding incompleto
  if (!me || me.role !== 'provider' || !ob || ob.complete) return null;

  const steps = [
    {
      key: 'has_establishment',
      label: 'Crear tu primer establecimiento',
      done: !!ob.has_establishment,
      to: '/dashboard/provider/establishments/new',
      fallbackTo: '/dashboard/provider/establishments',
    },
    {
      key: 'has_service',
      label: 'Añadir al menos un servicio',
      done: !!ob.has_service,
      to: '/dashboard/provider/services',
    },
    {
      key: 'has_availability',
      label: 'Configurar disponibilidad/horarios',
      done: !!ob.has_availability,
      to: '/dashboard/provider/availability',
    },
  ];

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-amber-900 m-0">Configura tu cuenta de proveedor</h3>
        <p className="text-xs text-amber-800 m-0">
          Completa estos pasos para empezar a recibir reservas.
        </p>
      </div>

      <ul className="space-y-2">
        {steps.map(step => (
          <li key={step.key} className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-amber-100">
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-2.5 w-2.5 rounded-full ${step.done ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              <span className={`text-sm ${step.done ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                {step.label}
              </span>
            </div>
            {!step.done ? (
              <Link
                to={step.to || step.fallbackTo}
                className="text-xs px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700"
              >
                Ir ahora
              </Link>
            ) : (
              <span className="text-xs text-emerald-600">Hecho</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
