import type { UseFormRegisterReturn } from 'react-hook-form'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { domainOptions, NEW_DOMAIN, useCustomDomains } from '../../lib/iepDomains'

/**
 * The Domain picker for IEP goals: the built-in domains, the organisation's own custom ones, and a
 * "+ Add a custom domain…" choice that reveals a text box. A custom domain typed here is saved to the
 * organisation's list when the goal is saved, so it's in the dropdown next time.
 *
 * Wire it to a react-hook-form form with register('domain') / register('customDomain') and pass the watched
 * `domain` value; turn the result into an API request with resolveDomainValue().
 */
export function DomainField({ selectProps, customProps, value, error, customError }: {
  selectProps: UseFormRegisterReturn
  customProps: UseFormRegisterReturn
  /** The current value of the form's domain field. */
  value: string | undefined
  error?: string
  customError?: string
}) {
  const { names } = useCustomDomains()
  return (
    <div className="space-y-2">
      <Select label="Domain" placeholder="Select domain…" options={domainOptions(names)} error={error} {...selectProps} />
      {value === NEW_DOMAIN && (
        <Input
          label="Custom domain name"
          placeholder="e.g. Feeding and Swallowing"
          maxLength={60}
          error={customError}
          {...customProps}
        />
      )}
    </div>
  )
}

/** Validation rule for the custom-name box: required only while "add a custom domain" is selected. */
export const customDomainRule = {
  validate: (v: string | undefined, form: { domain?: string }) =>
    form.domain !== NEW_DOMAIN || !!v?.trim() || 'Enter a name for the domain',
}
