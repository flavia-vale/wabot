// Quem pode ver o quê no admin — decidido pela PERMISSÃO que o backend já
// devolve em GET /api/admin/me, nunca por lista de e-mails no código.
//
// Q7 da auditoria (2026-10-02): duas telas liberavam a fila de Sucesso do
// Cliente por uma lista fixa de três e-mails. Trocar de conta, entrar alguém
// na equipe ou sair alguém exigia deploy — e o backend já decide por papel
// (as rotas /success/* exigem `support:read`). A tela só repete essa regra.

export const CUSTOMER_SUCCESS_PERMISSION = 'support:read'

export function hasPermission(admin, permission) {
  const permissions = Array.isArray(admin?.permissions) ? admin.permissions : []
  return permissions.includes(permission)
}

export function canAccessCustomerSuccess(admin) {
  return admin?.role === 'owner' || hasPermission(admin, CUSTOMER_SUCCESS_PERMISSION)
}
