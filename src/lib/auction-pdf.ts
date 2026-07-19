import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { displayPhone } from "@/lib/phone";

export type AuctionLogPdf = {
  id: string;
  product_name: string;
  brand?: string | null;
  series?: string | null;
  scale?: string | null;
  winner_name?: string | null;
  winner_email?: string | null;
  winner_phone?: string | null;
  winning_bid?: number | null;
  total_bids: number;
  participant_count: number;
  started_at?: string | null;
  ended_at: string;
  duration_seconds?: number | null;
  status: string;
  closed_by_name?: string | null;
  bid_history?: Array<{ user?: string; amount?: number; at?: string }> | null;
};

const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleString("en-IN") : "—");
const fmtInr = (v?: number | null) => (v == null ? "—" : `₹${v.toLocaleString("en-IN")}`);
const fmtDur = (s?: number | null) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
};

function header(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("THE DIECAST VAULT", 40, 40);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text("Auction Records", 40, 56);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 40, 90);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(subtitle, 40, 106);
    doc.setTextColor(0);
  }
  doc.setDrawColor(200);
  doc.line(40, 118, 555, 118);
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(`Generated ${new Date().toLocaleString("en-IN")}`, 40, 810);
    doc.text(`Page ${i} of ${pages}`, 500, 810);
    doc.setTextColor(0);
  }
}

/** Simple summary table PDF. */
export function exportAuctionLogsPdf(logs: AuctionLogPdf[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  header(doc, "Auction Logs Summary", `${logs.length} auction${logs.length === 1 ? "" : "s"}`);
  autoTable(doc, {
    startY: 132,
    head: [["Product", "Winner", "Email", "Phone", "Winning Bid", "Bids", "Ended", "Status"]],
    body: logs.map((l) => [
      `${l.product_name}${l.series ? `\n${l.series}` : ""}`,
      l.winner_name ?? "—",
      l.winner_email ?? "—",
      displayPhone(l.winner_phone),
      fmtInr(l.winning_bid),
      String(l.total_bids),
      fmtDate(l.ended_at),
      l.status,
    ]),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 40, right: 40 },
  });
  footer(doc);
  doc.save(`auction-logs-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Detailed audit-quality report — one section per auction. */
export function exportAuctionAuditPdf(logs: AuctionLogPdf[], staffActions: Array<{ created_at: string; actor_email: string | null; action: string; entity_id: string | null; metadata: unknown }> = []) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const first = logs[0];
  const title = logs.length === 1 && first
    ? `Audit Report — ${first.product_name}`
    : `Auction Audit Report — ${logs.length} auctions`;
  header(doc, title, `Confidential record for internal use`);

  let y = 140;
  logs.forEach((l, idx) => {
    if (idx > 0) { doc.addPage(); y = 60; }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`${idx + 1}. ${l.product_name}`, 40, y);
    y += 6;
    doc.setDrawColor(220);
    doc.line(40, y, 555, y);
    y += 10;

    autoTable(doc, {
      startY: y,
      head: [["Field", "Value"]],
      body: [
        ["Auction Name", `${l.product_name}${l.series ? ` · ${l.series}` : ""}`],
        ["Product", [l.brand, l.product_name, l.scale].filter(Boolean).join(" · ")],
        ["Start Time", fmtDate(l.started_at)],
        ["End Time", fmtDate(l.ended_at)],
        ["Duration", fmtDur(l.duration_seconds)],
        ["Winner", l.winner_name ?? "—"],
        ["Winner Email", l.winner_email ?? "—"],
        ["Winner Phone", displayPhone(l.winner_phone)],
        ["Final Bid", fmtInr(l.winning_bid)],
        ["Total Bids", String(l.total_bids)],
        ["Participants", String(l.participant_count)],
        ["Status", l.status],
        ["Closed By", l.closed_by_name ?? "—"],
      ],
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255 },
      columnStyles: { 0: { cellWidth: 130, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
      margin: { left: 40, right: 40 },
      theme: "grid",
    });
    // @ts-expect-error jspdf-autotable augments doc
    y = doc.lastAutoTable.finalY + 16;

    const bids = Array.isArray(l.bid_history) ? l.bid_history : [];
    if (bids.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Bid History", 40, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["#", "Bidder", "Amount", "Time"]],
        body: bids.map((b, i) => [String(i + 1), b.user ?? "—", fmtInr(b.amount), fmtDate(b.at)]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [60, 60, 60], textColor: 255 },
        margin: { left: 40, right: 40 },
        theme: "striped",
      });
      // @ts-expect-error jspdf-autotable augments doc
      y = doc.lastAutoTable.finalY + 16;
    }

    const related = staffActions.filter((a) => a.entity_id === l.id || (a.metadata && typeof a.metadata === "object" && (a.metadata as Record<string, unknown>).session_id === l.id));
    if (related.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Staff Actions & Status Changes", 40, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Timestamp", "Actor", "Action"]],
        body: related.map((a) => [fmtDate(a.created_at), a.actor_email ?? "—", a.action]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [60, 60, 60], textColor: 255 },
        margin: { left: 40, right: 40 },
        theme: "striped",
      });
      // @ts-expect-error jspdf-autotable augments doc
      y = doc.lastAutoTable.finalY + 16;
    }
  });

  footer(doc);
  const name = logs.length === 1 && first
    ? `audit-${first.product_name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`
    : `auction-audit-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(name);
}
