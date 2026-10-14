import { MaskedInput } from "@/components/masked-input";
import { AddressFields } from "@/components/address-fields";
import { Field, FormGroup, inputCls, textareaCls } from "@/components/ui";

export type CustomerValues = {
  name?: string | null;
  cnpj?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  city?: string | null;
  notes?: string | null;
  zip?: string | null;
  street?: string | null;
  street_number?: string | null;
  complement?: string | null;
  district?: string | null;
  state?: string | null;
};

// Campos do cliente, iguais no cadastro e na edição.
export function CustomerFields({ values = {} }: { values?: CustomerValues }) {
  const v = (x: string | null | undefined) => x ?? "";
  return (
    <>
      <Field label="CNPJ" className="sm:col-span-2">
        <MaskedInput mask="cnpj" lookup="customer" name="cnpj" defaultValue={v(values.cnpj)} className={inputCls} />
      </Field>
      <Field label="Razão social" className="sm:col-span-2">
        <input name="name" required defaultValue={v(values.name)} placeholder="Ex.: Loja Central Ltda." className={inputCls} />
      </Field>
      <Field label="Contato" hint="Quem compra ou atende você.">
        <input name="contact_name" defaultValue={v(values.contact_name)} autoComplete="off" className={inputCls} />
      </Field>
      <Field label="Telefone" hint="Com DDD. Usado no WhatsApp.">
        <MaskedInput mask="phone" name="phone" defaultValue={v(values.phone)} className={inputCls} />
      </Field>

      <FormGroup title="Endereço" />
      <AddressFields values={values} />

      <FormGroup title="Anotações" />
      <Field label="Observações" className="sm:col-span-2">
        <textarea name="notes" rows={3} defaultValue={v(values.notes)} className={textareaCls} />
      </Field>
    </>
  );
}
