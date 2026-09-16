// Directorio de agencias de los couriers soportados.
//
// El dataset oficial (Shalom, Emtrafesa, Marvisur, Olva, Flores) vive en
// ./agenciesData.js — se genera desde los directorios oficiales y NO se
// edita a mano. Aquí solo se le añade `id` + `label` y se combina con las
// agencias que el administrador cargue desde la sección "Base de datos"
// del panel (ver ../utils/customAgencies.js).
//
// Todos los consumidores (búsqueda, orden por distancia, resumen de
// WhatsApp) solo esperan objetos con la forma
// { id, courier, label, address, reference, lat, lng }.
import { RAW_AGENCIES } from './agenciesData'
import { getCustomAgencies, getCustomCouriers } from '../utils/customAgencies'

export const COURIERS = {
  shalom: { id: 'shalom', label: 'Shalom' },
  emtrafesa: { id: 'emtrafesa', label: 'Emtrafesa' },
  marvisur: { id: 'marvisur', label: 'Marvisur' },
  olva: { id: 'olva', label: 'Olva Courier' },
  flores: { id: 'flores', label: 'Transportes Flores' },
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
 * (Las guardadas en Supabase se agregan aparte — ver AgencySearch, que
 * las suma de forma asíncrona porque implican una llamada de red.)
 */
export function getAgenciesForCourier(courierId) {
  return [...AGENCIES, ...getCustomAgencies()].filter((a) => a.courier === courierId)
}

/**
 * Couriers conocidos por ESTE dispositivo sin red: los de fábrica más los
 * que el admin haya creado localmente (ver utils/customAgencies.js). Para
 * incluir también los couriers nuevos que solo existen en Supabase, usa
 * utils/supabaseAgencies.js → extractCouriersFromRows sobre el resultado de
 * fetchAllSupabaseAgencies().
 */
export function getKnownCouriers() {
  const baked = Object.values(COURIERS)
  const knownIds = new Set(baked.map((c) => c.id))
  return [...baked, ...getCustomCouriers(knownIds)]
}
