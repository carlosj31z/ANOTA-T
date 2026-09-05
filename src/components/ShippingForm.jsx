import { useMemo, useState } from 'react'
import AgencySearch from './AgencySearch'
import { IconCalendar, IconChevronDown } from './icons'
import { COURIERS } from '../data/agencies'
import { DEPARTMENTS } from '../data/departments'
import { PAYMENT_METHODS } from '../data/paymentMethods'
import { generateAvailableDates } from '../utils/dates'
import { isNonEmpty, isValidDni, isValidPeruPhone } from '../utils/validation'

const DELIVERY_OPTIONS = [
  { value: 'store', label: 'Retiro en tienda' },
  { value: 'home', label: 'Envío a domicilio' },
  { value: 'agency:shalom', label: `Retiro en agencia ${COURIERS.shalom.label}` },
  { value: 'agency:marvisur', label: `Retiro en agencia ${COURIERS.marvisur.label}` },
  { value: 'agency:olva', label: `Retiro en agencia ${COURIERS.olva.label}` },
  { value: 'agency:encomienda', label: 'Retiro en otra agencia / encomienda' },
]

function FieldLabel({ children, required }) {
  return (
    <label className="mb-1.5 block text-sm font-semibold text-gray-200">
      {children}
      {required && <span className="text-red-400"> *</span>}
    </label>
  )
}

function FieldError({ message }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-400">{message}</p>
}

function TextField({ label, required, value, onChange, onBlur, error, placeholder, prefix, ...rest }) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div
        className={`flex items-center gap-2 rounded-xl border bg-white/5 px-3.5 py-3 backdrop-blur-sm transition ${
          error
            ? 'border-red-400/60'
            : 'border-white/10 focus-within:border-amber-400/70 focus-within:ring-2 focus-within:ring-amber-400/20'
        }`}
      >
        {prefix && <span className="font-semibold text-gray-500">{prefix}</span>}
        <input
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-gray-500 focus:outline-none"
          {...rest}
        />
      </div>
      <FieldError message={error} />
    </div>
  )
}

function SelectField({
  label,
  required,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  options,
  icon: Icon = IconChevronDown,
  hint,
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div
        className={`relative rounded-xl border bg-white/5 backdrop-blur-sm transition ${
          error
            ? 'border-red-400/60'
            : 'border-white/10 focus-within:border-amber-400/70 focus-within:ring-2 focus-within:ring-amber-400/20'
        }`}
      >
        <select
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          className={`w-full appearance-none bg-transparent px-3.5 py-3 pr-10 text-[15px] focus:outline-none ${
            value ? 'text-white' : 'text-gray-500'
          }`}
        >
          <option value="" className="bg-gray-900 text-gray-400">
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-gray-900 text-white">
              {o.label}
            </option>
          ))}
        </select>
        <Icon className="pointer-events-none absolute right-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-500" />
      </div>
      {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
      <FieldError message={error} />
    </div>
  )
}

const initialState = {
  phone: '',
  deliveryMethod: '',
  fullName: '',
  dni: '',
  agency: null,
  manualAgencyName: '',
  manualAddress: '',
  address: '',
  department: '',
  provinceDistrict: '',
  reference: '',
  paymentMethod: '',
  notes: '',
  shippingDate: null,
}

export default function ShippingForm({ merchant, onSubmit }) {
  const [form, setForm] = useState(initialState)
  const [touched, setTouched] = useState({})
  const [attempted, setAttempted] = useState(false)

  const availableDates = useMemo(() => generateAvailableDates(merchant), [merchant])

  const isAgencyFlow = form.deliveryMethod.startsWith('agency:')
  const courierId = isAgencyFlow ? form.deliveryMethod.split(':')[1] : null
  const isKnownCourier = ['shalom', 'marvisur', 'olva'].includes(courierId)
  const isHome = form.deliveryMethod === 'home'
  const isStore = form.deliveryMethod === 'store'

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function markTouched(field) {
    setTouched((t) => ({ ...t, [field]: true }))
  }

  function handleDeliveryMethodChange(e) {
    const value = e.target.value
    setForm((f) => ({
      ...initialState,
      phone: f.phone,
      shippingDate: f.shippingDate,
      deliveryMethod: value,
    }))
  }

  function getErrors() {
    const e = {}
    if (!isValidPeruPhone(form.phone)) e.phone = 'Ingresa un WhatsApp válido (9 dígitos, empieza con 9).'
    if (!form.deliveryMethod) e.deliveryMethod = 'Selecciona cómo quieres recibir tu pedido.'

    if (isAgencyFlow) {
      if (isKnownCourier && !form.agency) e.agency = 'Busca y selecciona tu agencia.'
      if (!isKnownCourier && !isNonEmpty(form.manualAgencyName)) {
        e.manualAgencyName = 'Indica el nombre de la agencia.'
      }
      if (!isKnownCourier && !isNonEmpty(form.manualAddress)) {
        e.manualAddress = 'Indica la dirección de recojo.'
      }
      if (!isValidDni(form.dni)) e.dni = 'Ingresa un DNI (8 dígitos) o CE válido.'
    }

    if (isHome) {
      if (!isNonEmpty(form.address)) e.address = 'Ingresa la dirección exacta de entrega.'
      if (!form.department) e.department = 'Selecciona el departamento.'
      if (!isNonEmpty(form.provinceDistrict)) e.provinceDistrict = 'Indica la provincia y distrito.'
      if (!form.paymentMethod) e.paymentMethod = 'Selecciona un método de pago.'
    }

    if (form.deliveryMethod && !isNonEmpty(form.fullName)) e.fullName = 'Ingresa tu nombre y apellidos.'
    if (form.deliveryMethod && !form.shippingDate) e.shippingDate = 'Elige una fecha de envío.'

    return e
  }

  const errors = getErrors()
  const showError = (field) => Boolean((touched[field] || attempted) && errors[field])

  function handleSubmit(e) {
    e.preventDefault()
    setAttempted(true)
    if (Object.keys(getErrors()).length > 0) return

    const agency = isKnownCourier
      ? form.agency
      : isAgencyFlow
        ? { label: form.manualAgencyName, address: form.manualAddress, reference: '' }
        : null

    onSubmit({
      phone: form.phone,
      deliveryMethod: isAgencyFlow ? 'agency' : form.deliveryMethod,
      courier: isAgencyFlow ? courierId : null,
      agency,
      dni: form.dni,
      fullName: form.fullName,
      address: form.address,
      department: form.department,
      provinceDistrict: form.provinceDistrict,
      reference: form.reference,
      paymentMethod: form.paymentMethod,
      notes: form.notes,
      shippingDate: form.shippingDate,
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <TextField
        label="Tu WhatsApp"
        required
        prefix="+51"
        type="tel"
        inputMode="numeric"
        maxLength={9}
        value={form.phone}
        placeholder="9XXXXXXXX"
        onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 9))}
        onBlur={() => markTouched('phone')}
        error={showError('phone') ? errors.phone : null}
      />

      <SelectField
        label="¿Cómo quieres recibir tu pedido?"
        required
        placeholder="Elige una opción…"
        value={form.deliveryMethod}
        onChange={handleDeliveryMethodChange}
        onBlur={() => markTouched('deliveryMethod')}
        error={showError('deliveryMethod') ? errors.deliveryMethod : null}
        options={DELIVERY_OPTIONS}
      />

      {isAgencyFlow && (
        <div className="animate-fade-in-up space-y-5">
          {isKnownCourier ? (
            <AgencySearch
              key={courierId}
              courierId={courierId}
              value={form.agency}
              onChange={(agency) => set('agency', agency)}
              error={showError('agency') ? errors.agency : null}
            />
          ) : (
            <>
              <TextField
                label="Nombre de la agencia"
                required
                value={form.manualAgencyName}
                placeholder="Ej: Encomiendas El Rápido"
                onChange={(e) => set('manualAgencyName', e.target.value)}
                onBlur={() => markTouched('manualAgencyName')}
                error={showError('manualAgencyName') ? errors.manualAgencyName : null}
              />
              <TextField
                label="Dirección de recojo"
                required
                value={form.manualAddress}
                placeholder="Av., calle, referencia…"
                onChange={(e) => set('manualAddress', e.target.value)}
                onBlur={() => markTouched('manualAddress')}
                error={showError('manualAddress') ? errors.manualAddress : null}
              />
            </>
          )}

          <TextField
            label="DNI/CE para Recoger"
            required
            value={form.dni}
            placeholder="Documento de identidad"
            onChange={(e) => set('dni', e.target.value.toUpperCase().slice(0, 12))}
            onBlur={() => markTouched('dni')}
            error={showError('dni') ? errors.dni : null}
          />
        </div>
      )}

      {isHome && (
        <div className="animate-fade-in-up space-y-5">
          <TextField
            label="Dirección exacta de entrega"
            required
            value={form.address}
            placeholder="Av./Jr./Calle, número, urbanización…"
            onChange={(e) => set('address', e.target.value)}
            onBlur={() => markTouched('address')}
            error={showError('address') ? errors.address : null}
          />
          <SelectField
            label="Departamento"
            required
            placeholder="Selecciona tu departamento…"
            value={form.department}
            onChange={(e) => set('department', e.target.value)}
            onBlur={() => markTouched('department')}
            error={showError('department') ? errors.department : null}
            options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
          />
          <TextField
            label="Provincia / Distrito"
            required
            value={form.provinceDistrict}
            placeholder="Ej: Trujillo / El Porvenir"
            onChange={(e) => set('provinceDistrict', e.target.value)}
            onBlur={() => markTouched('provinceDistrict')}
            error={showError('provinceDistrict') ? errors.provinceDistrict : null}
          />
          <TextField
            label="Referencia para la entrega"
            value={form.reference}
            placeholder="Ej: Frente al parque, casa color azul"
            onChange={(e) => set('reference', e.target.value)}
          />
          <SelectField
            label="Método de pago"
            required
            placeholder="Elige una opción…"
            value={form.paymentMethod}
            onChange={(e) => set('paymentMethod', e.target.value)}
            onBlur={() => markTouched('paymentMethod')}
            error={showError('paymentMethod') ? errors.paymentMethod : null}
            options={PAYMENT_METHODS}
          />
        </div>
      )}

      {(isAgencyFlow || isHome || isStore) && (
        <div className="animate-fade-in-up">
          <TextField
            label="Nombre y Apellidos"
            required
            value={form.fullName}
            placeholder="Tu nombre completo"
            onChange={(e) => set('fullName', e.target.value)}
            onBlur={() => markTouched('fullName')}
            error={showError('fullName') ? errors.fullName : null}
          />
        </div>
      )}

      {form.deliveryMethod && (
        <div className="animate-fade-in-up space-y-5">
          <TextField
            label="Notas / Observaciones para el repartidor"
            value={form.notes}
            placeholder="Opcional"
            onChange={(e) => set('notes', e.target.value)}
          />

          <SelectField
            label="Fecha de Envío"
            required
            placeholder="Elige una fecha…"
            icon={IconCalendar}
            hint="(El envío puede estar en 24 a 48 horas, consulta siempre la página web del establecimiento)"
            value={form.shippingDate?.value ?? ''}
            onChange={(e) => {
              const picked = availableDates.find((d) => d.value === e.target.value) ?? null
              set('shippingDate', picked)
            }}
            onBlur={() => markTouched('shippingDate')}
            error={showError('shippingDate') ? errors.shippingDate : null}
            options={availableDates}
          />
        </div>
      )}

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3.5 text-[15px] font-bold text-white shadow-[0_8px_30px_-8px_rgba(249,115,22,0.6)] transition hover:from-amber-400 hover:to-orange-500 active:scale-[0.99]"
      >
        Agendar y ver resumen
        <IconCalendar className="h-5 w-5" />
      </button>
    </form>
  )
}
