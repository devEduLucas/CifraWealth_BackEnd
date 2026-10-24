const MAX_IMAGE_BYTES = 200 * 1024;

export function isProfileImage(value: string): boolean {
  const match =
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  const format = match?.[1],
    encoded = match?.[2];
  if (!format || !encoded || encoded.length % 4 !== 0) return false;
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length > MAX_IMAGE_BYTES || bytes.toString("base64") !== encoded)
    return false;
  if (format === "jpeg")
    return (
      bytes.length > 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  if (format === "png")
    return (
      bytes.length > 8 &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  return (
    bytes.length > 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  );
}
