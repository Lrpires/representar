// Endereço público de uma foto de produto guardada no Supabase.
export function productImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
}

// Endereço público da foto de perfil.
export function avatarUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
}
