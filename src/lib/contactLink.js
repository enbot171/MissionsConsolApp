const IG_HANDLE = /^[A-Za-z0-9._]{1,30}$/;

export function contactLink(contactType, contact) {
  if (contactType !== "InstagramID" || !contact) return null;
  const handle = contact.trim().replace(/^@/, "");
  if (!IG_HANDLE.test(handle)) return null;
  return { url: `https://instagram.com/${handle}`, label: "Instagram" };
}
