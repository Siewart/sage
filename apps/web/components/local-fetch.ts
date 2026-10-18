/** Keep all browser data traffic on the explicitly paired loopback service. */
export const localFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, targetAddressSpace: "loopback" } as RequestInit);
