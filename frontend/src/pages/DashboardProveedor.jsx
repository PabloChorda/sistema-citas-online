import ProviderEstablishmentsList from '../components/ProviderEstablishmentsList';

function DashboardProveedor() {
  const providerId = 6; // ⚠️ Obtén esto del JWT, contexto o props

  return (
    <div>
      <h1>Panel de Control del Proveedor</h1>
      <ProviderEstablishmentsList providerId={providerId} />
    </div>
  );
}

export default DashboardProveedor;

