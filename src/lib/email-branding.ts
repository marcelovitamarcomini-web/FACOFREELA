export const emailBranding = {
  confirmationLogoPath: '/email/logo-confirmacao.png',
  confirmationLogoAlt: 'Faço Freela',
};

export function buildEmailBrandingAssetUrl(origin: string, path = emailBranding.confirmationLogoPath) {
  return new URL(path, origin).toString();
}
