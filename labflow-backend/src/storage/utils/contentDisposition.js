const createDownloadContentDisposition = (originalFileName) => {
  const normalizedFileName = String(originalFileName || "attachment").trim();

  const asciiFallback = normalizedFileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_")
    .replace(/[\r\n]/g, "_")
    .slice(0, 255);

  const safeFallback = asciiFallback || "attachment";

  const encodedFileName = encodeURIComponent(normalizedFileName).replace(
    /['()*]/g,
    (character) => {
      return `%${character.charCodeAt(0).toString(16).toUpperCase()}`;
    },
  );

  return (
    `attachment; filename="${safeFallback}"; ` +
    `filename*=UTF-8''${encodedFileName}`
  );
};

module.exports = {
  createDownloadContentDisposition,
};
