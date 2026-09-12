// Directorio de agencias de los couriers soportados.
//
// El dataset oficial (Shalom, Emtrafesa, Marvisur, Olva) vive en
// ./agenciesData.js — se genera desde los directorios oficiales y NO se
// edita a mano. Aquí solo se le añade `id` + `label` y se combina con las
// agencias que el administrador cargue desde la sección "Base de datos"
// del panel (ver ../utils/customAgencies.js).
//
// Todos los consumidores (búsqueda, orden por distancia, resumen de
// WhatsApp) solo esperan objetos con la forma
// { id, courier, label, address, reference, lat, lng }.
import { RAW_AGENCIES } from './agenciesData'
import { getCustomAgencies } from '../utils/customAgencies'

export const COURIERS = {
  shalom: { id: 'shalom', label: 'Shalom' },
  emtrafesa: { id: 'emtrafesa', label: 'Emtrafesa' },
  marvisur: { id: 'marvisur', label: 'Marvisur' },
  olva: { id: 'olva', label: 'Olva Courier' },
}

// Agencias "de fábrica" (directorio oficial baked-in), con id + label.
export const AGENCIES = RAW_AGENCIES.map((a, index) => ({
  id: `${a.courier}-${index}`,
  label: [a.department, a.province, a.district, a.zone].filter(Boolean).join(' / '),
  ...a,
}))

/**
 * Agencias de un courier: combina el directorio oficial con las agencias
 * personalizadas que el administrador haya cargado en ESTE dispositivo.
 */
export function getAgenciesForCourier(courierId) {
  return [...AGENCIES, ...getCustomAgencies()].filter((a) => a.courier === courierId)
}
