export type ParsedInquiry = {
  customerName?: string; customerEmail?: string; customerPhone?: string;
  portal?: string; propertyName?: string; propertyAddress?: string;
  station?: string; rent?: number; area?: number; layout?: string;
  inquiryContent?: string; inquiryId?: string;
};

export function parseInquiryEmail(subject: string, body: string, from: string): ParsedInquiry {
  const result: ParsedInquiry = {};
  result.customerEmail = from;
  if (subject.includes("アパマン") || body.includes("apamanshop")) { result.portal = "アパマンショップ"; parseApaman(body, result); }
  else if (subject.includes("SUUMO") || body.includes("suumo")) { result.portal = "SUUMO"; parseSuumo(body, result); }
  else { result.portal = "その他"; parseGeneric(body, result); }
  return result;
}

function parseApaman(body: string, r: ParsedInquiry) {
  const nameMatch = body.match(/氏名[：:]\s*(.+)/); if (nameMatch) r.customerName = nameMatch[1].trim();
  const phoneMatch = body.match(/電話[：:]\s*([\d-]+)/); if (phoneMatch) r.customerPhone = phoneMatch[1].trim();
  const propMatch = body.match(/物件名[：:]\s*(.+)/); if (propMatch) r.propertyName = propMatch[1].trim();
  const addrMatch = body.match(/所在地[：:]\s*(.+)/); if (addrMatch) r.propertyAddress = addrMatch[1].trim();
  const rentMatch = body.match(/賃料[：:]\s*([\d,]+)/); if (rentMatch) r.rent = parseInt(rentMatch[1].replace(/,/g, ""));
  const contentMatch = body.match(/問い合わせ内容[：:]\s*(.+)/s); if (contentMatch) r.inquiryContent = contentMatch[1].trim().substring(0, 500);
}

function parseSuumo(body: string, r: ParsedInquiry) {
  const nameMatch = body.match(/(?:お名前|名前)[：:]\s*(.+)/); if (nameMatch) r.customerName = nameMatch[1].trim();
  const phoneMatch = body.match(/(?:電話番号|TEL)[：:]\s*([\d-]+)/); if (phoneMatch) r.customerPhone = phoneMatch[1].trim();
  const propMatch = body.match(/(?:物件名|建物名)[：:]\s*(.+)/); if (propMatch) r.propertyName = propMatch[1].trim();
  const stationMatch = body.match(/(?:最寄|駅)[：:]\s*(.+)/); if (stationMatch) r.station = stationMatch[1].trim();
  const rentMatch = body.match(/(?:賃料|家賃)[：:]\s*([\d,.]+)/); if (rentMatch) r.rent = parseInt(rentMatch[1].replace(/[,万]/g, ""));
  const contentMatch = body.match(/(?:お問い合わせ内容|ご質問)[：:]\s*(.+)/s); if (contentMatch) r.inquiryContent = contentMatch[1].trim().substring(0, 500);
}

function parseGeneric(body: string, r: ParsedInquiry) {
  const nameMatch = body.match(/(?:氏名|名前)[：:]\s*(.+)/); if (nameMatch) r.customerName = nameMatch[1].trim();
  const phoneMatch = body.match(/(?:電話|TEL)[：:]\s*([\d-]+)/); if (phoneMatch) r.customerPhone = phoneMatch[1].trim();
  r.inquiryContent = body.substring(0, 500);
}
