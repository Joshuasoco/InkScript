const stripHtmlTags = (source: string): string => source.replace(/<[^>]+>/g, '');

export const sanitizePastedText = (rawValue: string): string => {
  return stripHtmlTags(rawValue).replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n');
};
