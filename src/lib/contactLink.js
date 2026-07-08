export function contactLink(contactType, contact) {
  if (contactType !== "InstagramID" || !contact) return null;
  const handle = contact.trim().replace(/^@/, "");
  if (!handle) return null;
  return { url: `https://instagram.com/${encodeURIComponent(handle)}`, label: "Instagram" };
}
