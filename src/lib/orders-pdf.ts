import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { displayPhone } from "@/lib/phone";

export type OrderItemPdf = {
  product_name: string;
  product_series?: string | null;
  quantity: number;
  unit_price_cents?: number | null;
  line_total_cents: number;
};

export type OrderPdf = {
  id: string;
  order_number: string;
  status: string;
  payment_status?: string | null;
  created_at: string;
  contact_email?: string | null;
  total_cents: number;
  subtotal_cents?: number | null;
  discount_cents?: number | null;
  tax_cents?: number | null;
  shipping_cents?: number | null;
  coupon_code?: string | null;
  payment_method?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  notes?: string | null;
  admin_notes?: string | null;
  shipping_address?: Record<string, unknown> | null;
  order_items?: OrderItemPdf[] | null;
};

const inr = (v?: number | null) => (v == null ? "—" : `Rs. ${Math.round(v / 100).toLocaleString("en-IN")}`);
const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("en-IN") : "—");
const payMethod = (m?: string | null) => (m === "cod" ? "Cash on delivery" : m === "online" ? "Online" : m ?? "—");

function header(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text("THE DIECAST VAULT", 40, 40);
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(120);
  doc.text("Order Records", 40, 56);
  doc.setTextColor(0); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text(title, 40, 90);
  if (subtitle) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100);
    doc.text(subtitle, 40, 106); doc.setTextColor(0);
  }
  doc.setDrawColor(200); doc.line(40, 118, 555, 118);
}

function pageFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(9); doc.setTextColor(150);
    doc.text(`Generated ${new Date().toLocaleString("en-IN")}`, 40, 810);
    doc.text(`Page ${i} of ${pages}`, 500, 810);
    doc.setTextColor(0);
  }
}

/** Summary table PDF for a list of orders. */
export function exportOrdersPdf(orders: OrderPdf[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  header(doc, "Orders Summary", `${orders.length} order${orders.length === 1 ? "" : "s"}`);
  autoTable(doc, {
    startY: 132,
    head: [["Order #", "Customer", "Phone", "Total", "Items", "Order", "Payment", "Created"]],
    body: orders.map((o) => {
      const addr = (o.shipping_address ?? {}) as Record<string, string>;
      return [
        o.order_number,
        o.contact_email ?? "—",
        displayPhone(addr.phone),
        inr(o.total_cents),
        String(o.order_items?.length ?? 0),
        o.status,
        o.payment_status ?? "pending",
        dt(o.created_at),
      ];
    }),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [20, 20, 20], textColor: 255 },
  });
  pageFooter(doc);
  doc.save(`orders-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Detailed single-order PDF (invoice-style). */
export function exportOrderPdf(o: OrderPdf) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  header(doc, `Order ${o.order_number}`, dt(o.created_at));

  let y = 140;
  const addr = (o.shipping_address ?? {}) as Record<string, string>;
  const countryCode = addr.country_code ?? "+91";
  doc.setFontSize(10);

  const kv: Array<[string, string]> = [
    ["Customer", (addr.full_name as string) ?? "—"],
    ["Email", o.contact_email ?? "—"],
    ["Country code", countryCode],
    ["Phone", displayPhone(addr.phone)],
    ["Order status", o.status],
    ["Payment status", o.payment_status ?? "pending"],
    ["Payment method", payMethod(o.payment_method)],
  ];
  if (o.tracking_number) kv.push(["Tracking", String(o.tracking_number)]);
  if (o.coupon_code) kv.push(["Coupon", String(o.coupon_code)]);
  for (const [k, v] of kv) {
    doc.setFont("helvetica", "bold"); doc.text(k, 40, y);
    doc.setFont("helvetica", "normal"); doc.text(String(v), 140, y);
    y += 16;
  }

  if (addr && Object.keys(addr).length > 0) {
    y += 6;
    doc.setFont("helvetica", "bold"); doc.text("Shipping address", 40, y); y += 14;
    doc.setFont("helvetica", "normal");
    const lines = [
      addr.line1, addr.line2 ?? "",
      [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "),
      addr.country,
    ].filter(Boolean) as string[];
    for (const l of lines) { doc.text(l, 40, y); y += 13; }
  }

  autoTable(doc, {
    startY: y + 10,
    head: [["Item", "Category / Series", "Qty", "Unit", "Total"]],
    body: (o.order_items ?? []).map((i) => [
      i.product_name,
      i.product_series ?? "—",
      String(i.quantity),
      inr(i.unit_price_cents ?? Math.round((i.line_total_cents / Math.max(1, i.quantity)))),
      inr(i.line_total_cents),
    ]),
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [20, 20, 20], textColor: 255 },
  });

  // Totals
  // @ts-expect-error autotable augments doc
  const afterY: number = (doc.lastAutoTable?.finalY ?? y + 20) + 16;
  const rightX = 555;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  const totals: Array<[string, string]> = [];
  if (o.subtotal_cents != null) totals.push(["Subtotal", inr(o.subtotal_cents)]);
  if ((o.discount_cents ?? 0) > 0) totals.push([`Discount${o.coupon_code ? ` (${o.coupon_code})` : ""}`, `- ${inr(o.discount_cents)}`]);
  if (o.tax_cents != null) totals.push(["GST", inr(o.tax_cents)]);
  if (o.shipping_cents != null) totals.push(["Shipping", o.shipping_cents === 0 ? "Free" : inr(o.shipping_cents)]);
  let ty = afterY;
  for (const [label, val] of totals) {
    doc.text(label, rightX - 200, ty); doc.text(val, rightX, ty, { align: "right" });
    ty += 14;
  }
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Grand Total", rightX - 200, ty + 6);
  doc.text(inr(o.total_cents), rightX, ty + 6, { align: "right" });

  if (o.notes) {
    ty += 40;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("Customer note", 40, ty);
    doc.setFont("helvetica", "normal");
    const split = doc.splitTextToSize(o.notes, 515);
    doc.text(split, 40, ty + 14);
  }

  pageFooter(doc);
  doc.save(`order-${o.order_number}.pdf`);
}

/** Per-order CSV: one row per line item plus totals so it opens cleanly in Excel. */
export function orderToCsvRows(o: OrderPdf): Record<string, unknown>[] {
  const addr = (o.shipping_address ?? {}) as Record<string, string>;
  const items = o.order_items ?? [];
  // Prefix with ="..." so Excel treats phone / order id as literal text (no scientific notation).
  const t = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return s ? `="${s.replace(/"/g, '""')}"` : "";
  };
  const base = {
    "Order ID": t(o.order_number),
    "Date": o.created_at,
    "Customer Name": addr.full_name ?? "",
    "Email": o.contact_email ?? "",
    "Country Code": t(addr.country_code ?? "+91"),
    "Phone": t(addr.phone ?? ""),
    "Payment Method": payMethod(o.payment_method),
    "Payment Status": o.payment_status ?? "pending",
    "Order Status": o.status,
    "Tracking Number": t(o.tracking_number ?? ""),
    "Coupon": o.coupon_code ?? "",
    "Subtotal (INR)": o.subtotal_cents != null ? Math.round(o.subtotal_cents / 100) : "",
    "Discount (INR)": (o.discount_cents ?? 0) > 0 ? Math.round((o.discount_cents ?? 0) / 100) : 0,
    "GST (INR)": o.tax_cents != null ? Math.round(o.tax_cents / 100) : "",
    "Shipping (INR)": o.shipping_cents != null ? Math.round(o.shipping_cents / 100) : "",
    "Grand Total (INR)": Math.round(o.total_cents / 100),
    "Customer Note": o.notes ?? "",
    "Staff Note": o.admin_notes ?? "",
  };
  if (items.length === 0) return [{ ...base, "Product": "", "Category": "", "Quantity": "", "Unit Price (INR)": "", "Line Total (INR)": "" }];
  return items.map((i) => ({
    ...base,
    "Product": i.product_name,
    "Category": i.product_series ?? "",
    "Quantity": i.quantity,
    "Unit Price (INR)": Math.round((i.unit_price_cents ?? Math.round(i.line_total_cents / Math.max(1, i.quantity))) / 100),
    "Line Total (INR)": Math.round(i.line_total_cents / 100),
  }));
}


export function exportAuditLogsPdf(rows: Array<{ created_at: string; actor_email?: string | null; action: string; entity_type?: string | null; entity_id?: string | null; metadata?: unknown }>) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  header(doc, "Audit Log", `${rows.length} entr${rows.length === 1 ? "y" : "ies"}`);
  autoTable(doc, {
    startY: 132,
    head: [["When", "Who", "Action", "Target", "Details"]],
    body: rows.map((l) => [
      dt(l.created_at),
      l.actor_email ?? "—",
      l.action,
      `${l.entity_type ?? ""}${l.entity_id ? ` #${l.entity_id.slice(0, 8)}` : ""}`,
      l.metadata ? JSON.stringify(l.metadata) : "",
    ]),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [20, 20, 20], textColor: 255 },
    columnStyles: { 4: { cellWidth: 200 } },
  });
  pageFooter(doc);
  doc.save(`audit-log-${new Date().toISOString().slice(0, 10)}.pdf`);
}
