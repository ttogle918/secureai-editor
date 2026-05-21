package io.secureai.backend.domain.report.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.entity.Vulnerability;
import io.secureai.backend.domain.project.entity.Project;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Template Method 패턴 — PDF 리포트 생성.
 * 섹션 순서: 표지 → 심각도별 요약 → 취약점 목록 → OWASP Top 10 매핑
 */
@Slf4j
@Component
public class PdfReportGenerator {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final List<String> SEVERITY_ORDER = List.of("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO");
    private static final Map<String, Color> SEVERITY_COLORS = Map.of(
            "CRITICAL", new Color(220, 38, 38),
            "HIGH",     new Color(234, 88, 12),
            "MEDIUM",   new Color(202, 138, 4),
            "LOW",      new Color(37, 99, 235),
            "INFO",     new Color(75, 85, 99)
    );

    public byte[] generate(List<Vulnerability> vulns, Project project, AnalysisSession session) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4, 50, 50, 50, 50);
            PdfWriter.getInstance(doc, baos);
            doc.open();

            addCoverPage(doc, project, session, vulns.size());
            doc.newPage();
            addSeveritySummary(doc, vulns);
            doc.newPage();
            addVulnerabilityList(doc, vulns);

            List<Vulnerability> owaspVulns = filterOwaspVulns(vulns);
            if (!owaspVulns.isEmpty()) {
                doc.newPage();
                addOwaspMapping(doc, owaspVulns);
            }

            doc.close();
            return baos.toByteArray();
        } catch (Exception e) {
            log.error("[PdfReportGenerator] PDF 생성 실패 projectId={}", project.getId(), e);
            throw new RuntimeException("PDF 생성에 실패했습니다.", e);
        }
    }

    private void addCoverPage(Document doc, Project project, AnalysisSession session, int totalVulns)
            throws DocumentException {
        doc.add(Chunk.NEWLINE);
        doc.add(Chunk.NEWLINE);
        doc.add(Chunk.NEWLINE);

        Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 24, Color.BLACK);
        Paragraph title = new Paragraph("SecureAI Security Report", titleFont);
        title.setAlignment(Element.ALIGN_CENTER);
        doc.add(title);

        doc.add(Chunk.NEWLINE);

        Font projectFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, new Color(30, 64, 175));
        Paragraph projectName = new Paragraph(project.getName(), projectFont);
        projectName.setAlignment(Element.ALIGN_CENTER);
        doc.add(projectName);

        doc.add(Chunk.NEWLINE);
        doc.add(Chunk.NEWLINE);

        Font infoFont = FontFactory.getFont(FontFactory.HELVETICA, 12, Color.DARK_GRAY);
        String generatedAt = OffsetDateTime.now().format(FORMATTER);
        addCenteredInfo(doc, "Generated: " + generatedAt, infoFont);
        addCenteredInfo(doc, "Total Vulnerabilities: " + totalVulns, infoFont);

        if (session != null) {
            addCenteredInfo(doc, "Session ID: " + session.getId(), infoFont);
        }
    }

    private void addCenteredInfo(Document doc, String text, Font font) throws DocumentException {
        Paragraph p = new Paragraph(text, font);
        p.setAlignment(Element.ALIGN_CENTER);
        doc.add(p);
    }

    private void addSeveritySummary(Document doc, List<Vulnerability> vulns) throws DocumentException {
        Font sectionFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, Color.BLACK);
        doc.add(new Paragraph("Severity Summary", sectionFont));
        doc.add(Chunk.NEWLINE);

        Map<String, Long> countBySeverity = vulns.stream()
                .collect(Collectors.groupingBy(Vulnerability::getSeverity, Collectors.counting()));

        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(50);
        table.setHorizontalAlignment(Element.ALIGN_LEFT);

        addTableHeader(table, "Severity");
        addTableHeader(table, "Count");

        for (String severity : SEVERITY_ORDER) {
            long count = countBySeverity.getOrDefault(severity, 0L);
            Color color = SEVERITY_COLORS.getOrDefault(severity, Color.BLACK);

            PdfPCell severityCell = new PdfPCell(new Phrase(severity,
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, color)));
            severityCell.setPadding(6);
            table.addCell(severityCell);

            PdfPCell countCell = new PdfPCell(new Phrase(String.valueOf(count),
                    FontFactory.getFont(FontFactory.HELVETICA, 10, Color.BLACK)));
            countCell.setPadding(6);
            table.addCell(countCell);
        }

        doc.add(table);
    }

    private void addTableHeader(PdfPTable table, String text) {
        PdfPCell cell = new PdfPCell(new Phrase(text,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.WHITE)));
        cell.setBackgroundColor(new Color(30, 64, 175));
        cell.setPadding(6);
        table.addCell(cell);
    }

    private void addVulnerabilityList(Document doc, List<Vulnerability> vulns) throws DocumentException {
        Font sectionFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, Color.BLACK);
        doc.add(new Paragraph("Vulnerability Details", sectionFont));
        doc.add(Chunk.NEWLINE);

        if (vulns.isEmpty()) {
            doc.add(new Paragraph("No vulnerabilities found.",
                    FontFactory.getFont(FontFactory.HELVETICA, 11, Color.DARK_GRAY)));
            return;
        }

        PdfPTable table = new PdfPTable(5);
        table.setWidthPercentage(100);
        float[] widths = {3f, 1f, 2f, 1.5f, 3f};
        table.setWidths(widths);

        for (String header : List.of("File", "Line", "Type", "Severity", "Description")) {
            addTableHeader(table, header);
        }

        Font cellFont = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.BLACK);
        for (Vulnerability v : vulns) {
            addVulnRow(table, v, cellFont);
        }

        doc.add(table);
    }

    private void addVulnRow(PdfPTable table, Vulnerability v, Font cellFont) {
        String fileName = extractFileName(v.getFilePath());
        table.addCell(createCell(fileName, cellFont));
        table.addCell(createCell(v.getLineNumber() != null ? String.valueOf(v.getLineNumber()) : "-", cellFont));
        table.addCell(createCell(v.getVulnType(), cellFont));

        Color severityColor = SEVERITY_COLORS.getOrDefault(v.getSeverity(), Color.BLACK);
        PdfPCell severityCell = new PdfPCell(new Phrase(v.getSeverity(),
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, severityColor)));
        severityCell.setPadding(4);
        table.addCell(severityCell);

        String description = v.getDescription() != null
                ? truncate(v.getDescription(), 120)
                : "-";
        table.addCell(createCell(description, cellFont));
    }

    private PdfPCell createCell(String text, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setPadding(4);
        return cell;
    }

    private void addOwaspMapping(Document doc, List<Vulnerability> owaspVulns) throws DocumentException {
        Font sectionFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, Color.BLACK);
        doc.add(new Paragraph("OWASP Top 10 Mapping", sectionFont));
        doc.add(Chunk.NEWLINE);

        Map<String, List<Vulnerability>> byOwasp = owaspVulns.stream()
                .collect(Collectors.groupingBy(v -> v.getOwasp() != null ? v.getOwasp() : "UNKNOWN"));

        Font boldFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, Color.BLACK);
        Font normalFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.DARK_GRAY);

        for (Map.Entry<String, List<Vulnerability>> entry : byOwasp.entrySet()) {
            doc.add(new Paragraph(entry.getKey() + " (" + entry.getValue().size() + " findings)", boldFont));
            for (Vulnerability v : entry.getValue()) {
                String line = "  - [" + v.getSeverity() + "] " + v.getVulnType()
                        + " in " + extractFileName(v.getFilePath());
                doc.add(new Paragraph(line, normalFont));
            }
            doc.add(Chunk.NEWLINE);
        }
    }

    private List<Vulnerability> filterOwaspVulns(List<Vulnerability> vulns) {
        return vulns.stream()
                .filter(v -> v.getOwasp() != null && !v.getOwasp().isBlank())
                .toList();
    }

    private String extractFileName(String filePath) {
        if (filePath == null) return "-";
        int lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
        return lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;
    }

    private String truncate(String text, int maxLength) {
        if (text.length() <= maxLength) return text;
        return text.substring(0, maxLength - 3) + "...";
    }
}
