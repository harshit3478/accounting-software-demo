import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface AttendanceEntry {
  id: number;
  date: Date | string;
  checkIn: Date | string | null;
  checkOut: Date | string | null;
  totalHours: number | null;
  notes?: string | null;
}

interface AttendanceData {
  entries: AttendanceEntry[];
  employeeName: string;
  employeeEmail: string;
  dateRange?: { start: string; end: string } | null;
}

export function generateAttendancePDF(data: AttendanceData) {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Attendance Report", 105, 20, { align: "center" });

  // Employee info section
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 28, {
    align: "center",
  });

  let yPos = 40;

  // Employee details box
  doc.setTextColor(0);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(15, yPos, 180, 26, 3, 3, "F");
  doc.setDrawColor(200, 200, 200);
  doc.roundedRect(15, yPos, 180, 26, 3, 3, "S");

  yPos += 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Employee Information", 20, yPos);

  yPos += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${data.employeeName}`, 20, yPos);
  doc.text(`Email: ${data.employeeEmail}`, 20, yPos + 6);

  yPos += 23;

  // Date range if applied
  if (data.dateRange) {
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 200);
    doc.setFont("helvetica", "bold");
    doc.text(
      `Period: ${new Date(
        data.dateRange.start
      ).toLocaleDateString()} - ${new Date(
        data.dateRange.end
      ).toLocaleDateString()}`,
      105,
      yPos,
      { align: "center" }
    );
    yPos += 10;
  }

  // Calculate summary statistics
  const WORKING_HOURS = parseFloat(process.env.NEXT_PUBLIC_WORKING_HOURS_PER_DAY || "8");
  const totalDays = data.entries.length;
  let totalHoursWorked = 0;
  let totalOvertime = 0;
  let daysWithFullData = 0;

  data.entries.forEach((entry) => {
    let hours = 0;
    if (entry.totalHours && entry.totalHours > 0) {
      hours = Number(entry.totalHours);
    } else if (entry.checkIn && entry.checkOut) {
      try {
        const checkIn = new Date(entry.checkIn).getTime();
        const checkOut = new Date(entry.checkOut).getTime();
        const computed = (checkOut - checkIn) / (1000 * 60 * 60);
        if (isFinite(computed) && computed > 0) {
          hours = computed;
        }
      } catch (err) {
        // Skip invalid dates
      }
    }

    if (hours > 0) {
      totalHoursWorked += hours;
      daysWithFullData++;
      if (hours > WORKING_HOURS) {
        totalOvertime += (hours - WORKING_HOURS);
      }
    }
  });

  const avgHoursPerDay =
    daysWithFullData > 0 ? totalHoursWorked / daysWithFullData : 0;

  // Summary section in a box
  doc.setTextColor(0);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(15, yPos, 180, 36, 3, 3, "F");
  doc.setDrawColor(200, 200, 200);
  doc.roundedRect(15, yPos, 180, 36, 3, 3, "S");

  yPos += 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 20, yPos);

  yPos += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  doc.text(`Total Days Present: ${totalDays}`, 20, yPos);
  doc.text(
    `Total Hours Worked: ${totalHoursWorked.toFixed(2)} hrs`,
    90,
    yPos
  );
  yPos += 6;
  doc.text(
    `Days with Complete Data: ${daysWithFullData}`,
    20,
    yPos
  );
  doc.text(
    `Average Hours/Day: ${avgHoursPerDay.toFixed(2)} hrs`,
    90,
    yPos
  );
  yPos += 6;
  doc.text(
    `Total Overtime: ${totalOvertime.toFixed(2)} hrs`,
    90,
    yPos
  );

  yPos += 15;

  // Prepare table data
  const tableData = data.entries.map((entry) => {
    const date = new Date(entry.date).toLocaleDateString();
    const checkIn = entry.checkIn
      ? new Date(entry.checkIn).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";
    const checkOut = entry.checkOut
      ? new Date(entry.checkOut).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";

    let totalHours = "-";
    let overtime = "-";
    let hoursVal = 0;

    if (entry.totalHours && entry.totalHours > 0) {
      hoursVal = Number(entry.totalHours);
      totalHours = hoursVal.toFixed(2);
    } else if (entry.checkIn && entry.checkOut) {
      try {
        const checkInTime = new Date(entry.checkIn).getTime();
        const checkOutTime = new Date(entry.checkOut).getTime();
        const hours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
        if (isFinite(hours) && hours > 0) {
          hoursVal = hours;
          totalHours = hours.toFixed(2);
        }
      } catch (err) {
        // Keep as "-"
      }
    }

    if (hoursVal > WORKING_HOURS) {
      overtime = (hoursVal - WORKING_HOURS).toFixed(2);
    }

    return [date, checkIn, checkOut, totalHours, overtime, entry.notes || "-"];
  });

  // Generate professional table with autoTable
  autoTable(doc, {
    startY: yPos,
    head: [["Date", "Check In", "Check Out", "Total Hours", "Overtime", "Notes"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: 50,
      cellPadding: 2,
      overflow: "linebreak",
      halign: "left",
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    columnStyles: {
      0: { cellWidth: 23 },
      1: { cellWidth: 23 },
      2: { cellWidth: 23 },
      3: { halign: "center", cellWidth: 20 },
      4: { halign: "center", cellWidth: 20 },
      5: { cellWidth: 68, overflow: "linebreak" },
    },
    margin: { left: 15, right: 15 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(150);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Generated on ${new Date().toLocaleString()} - Page ${i} of ${pageCount}`,
      105,
      285,
      { align: "center" }
    );
  }

  // Download
  const timestamp = new Date().toISOString().split("T")[0];
  const fileName = data.dateRange
    ? `attendance-${data.employeeName.replace(/\s+/g, "-")}-${
        data.dateRange.start
      }-to-${data.dateRange.end}.pdf`
    : `attendance-${data.employeeName.replace(/\s+/g, "-")}-${timestamp}.pdf`;

  doc.save(fileName);
}
