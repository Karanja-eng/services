"""
Professional Geotechnical PDF Report Generator
Uses ReportLab for production-quality reports
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
    PageBreak, Image, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas
from datetime import datetime
from typing import Dict, List, Optional
import io
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend


class GeotechnicalReport:
    """Professional geotechnical investigation report generator"""
    
    def __init__(self, project_info: Dict):
        self.project_info = project_info
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        
    def _setup_custom_styles(self):
        """Create custom paragraph styles"""
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))
        
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#374151'),
            spaceAfter=12,
            spaceBefore=20,
            fontName='Helvetica-Bold'
        ))
        
        self.styles.add(ParagraphStyle(
            name='SubSection',
            parent=self.styles['Heading3'],
            fontSize=12,
            textColor=colors.HexColor('#4b5563'),
            spaceAfter=10,
            fontName='Helvetica-Bold'
        ))
        
        self.styles.add(ParagraphStyle(
            name='BodyJustify',
            parent=self.styles['BodyText'],
            fontSize=11,
            alignment=TA_JUSTIFY,
            spaceAfter=12
        ))
    
    def generate_complete_report(
        self,
        phase_data: Optional[Dict] = None,
        atterberg_data: Optional[Dict] = None,
        compaction_data: Optional[Dict] = None,
        shear_data: Optional[Dict] = None,
        bearing_data: Optional[Dict] = None,
        consolidation_data: Optional[Dict] = None,
        slope_data: Optional[Dict] = None,
    ) -> bytes:
        """
        Generate complete geotechnical investigation report
        Returns PDF as bytes
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )
        
        # Build story (content)
        story = []
        
        # Cover page
        story.extend(self._create_cover_page())
        story.append(PageBreak())
        
        # Executive Summary
        story.extend(self._create_executive_summary())
        story.append(PageBreak())
        
        # Table of Contents
        story.extend(self._create_table_of_contents())
        story.append(PageBreak())
        
        # Section 1: Introduction
        story.extend(self._create_introduction())
        
        # Section 2: Field Investigation
        story.extend(self._create_field_investigation())
        
        # Section 3: Laboratory Testing
        if phase_data:
            story.extend(self._create_phase_section(phase_data))
        
        if atterberg_data:
            story.extend(self._create_atterberg_section(atterberg_data))
        
        if compaction_data:
            story.extend(self._create_compaction_section(compaction_data))
        
        if shear_data:
            story.extend(self._create_shear_section(shear_data))
        
        if consolidation_data:
            story.extend(self._create_consolidation_section(consolidation_data))
        
        # Section 4: Analysis & Design
        if bearing_data:
            story.extend(self._create_bearing_section(bearing_data))
        
        if slope_data:
            story.extend(self._create_slope_section(slope_data))
        
        # Section 5: Recommendations
        story.extend(self._create_recommendations())
        
        # Appendices
        story.append(PageBreak())
        story.extend(self._create_appendix())
        
        # Build PDF
        doc.build(story, onFirstPage=self._add_header_footer, 
                  onLaterPages=self._add_header_footer)
        
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
    
    def _create_cover_page(self) -> List:
        """Create professional cover page"""
        elements = []
        
        # Spacer
        elements.append(Spacer(1, 2*inch))
        
        # Title
        title = Paragraph(
            "GEOTECHNICAL INVESTIGATION REPORT",
            self.styles['CustomTitle']
        )
        elements.append(title)
        elements.append(Spacer(1, 0.5*inch))
        
        # Project name
        project_name = Paragraph(
            f"<b>{self.project_info.get('project_name', 'Project Name')}</b>",
            self.styles['Title']
        )
        elements.append(project_name)
        elements.append(Spacer(1, 0.3*inch))
        
        # Location
        location = Paragraph(
            f"{self.project_info.get('location', 'Project Location')}",
            self.styles['Normal']
        )
        elements.append(location)
        elements.append(Spacer(1, 2*inch))
        
        # Client info table
        client_data = [
            ['Prepared For:', self.project_info.get('client', 'Client Name')],
            ['Project No:', self.project_info.get('project_no', 'XXXX-XX')],
            ['Date:', datetime.now().strftime('%B %d, %Y')],
            ['Prepared By:', self.project_info.get('engineer', 'Geotechnical Engineer, PE')],
        ]
        
        client_table = Table(client_data, colWidths=[2*inch, 4*inch])
        client_table.setStyle(TableStyle([
            ('FONT', (0, 0), (-1, -1), 'Helvetica', 11),
            ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 11),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#374151')),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        
        elements.append(client_table)
        
        return elements
    
    def _create_executive_summary(self) -> List:
        """Create executive summary"""
        elements = []
        
        elements.append(Paragraph("EXECUTIVE SUMMARY", self.styles['SectionHeader']))
        
        summary_text = f"""
        This report presents the results of a geotechnical investigation performed for the 
        proposed {self.project_info.get('project_type', 'development')} at 
        {self.project_info.get('location', 'the project site')}. The investigation included 
        field exploration, laboratory testing, and engineering analysis to evaluate subsurface 
        conditions and provide geotechnical recommendations for design and construction.
        <br/><br/>
        <b>Key Findings:</b><br/>
        • Subsurface conditions are generally suitable for the proposed development<br/>
        • Foundation recommendations are provided based on laboratory test results<br/>
        • Site preparation and earthwork recommendations are included<br/>
        • Quality control testing recommendations are provided
        """
        
        elements.append(Paragraph(summary_text, self.styles['BodyJustify']))
        
        return elements
    
    def _create_table_of_contents(self) -> List:
        """Create table of contents"""
        elements = []
        
        elements.append(Paragraph("TABLE OF CONTENTS", self.styles['SectionHeader']))
        elements.append(Spacer(1, 0.2*inch))
        
        toc_data = [
            ['1.0', 'INTRODUCTION', '4'],
            ['2.0', 'FIELD INVESTIGATION', '5'],
            ['3.0', 'LABORATORY TESTING', '6'],
            ['3.1', 'Phase Relationships', '6'],
            ['3.2', 'Atterberg Limits', '7'],
            ['3.3', 'Compaction Testing', '8'],
            ['3.4', 'Shear Strength', '9'],
            ['3.5', 'Consolidation', '10'],
            ['4.0', 'ENGINEERING ANALYSIS', '11'],
            ['4.1', 'Bearing Capacity', '11'],
            ['4.2', 'Slope Stability', '12'],
            ['5.0', 'RECOMMENDATIONS', '13'],
            ['APPENDIX A', 'Laboratory Test Results', '14'],
            ['APPENDIX B', 'Boring Logs', '15'],
        ]
        
        toc_table = Table(toc_data, colWidths=[1*inch, 4.5*inch, 0.75*inch])
        toc_table.setStyle(TableStyle([
            ('FONT', (0, 0), (-1, -1), 'Helvetica', 10),
            ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 10),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#374151')),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.grey),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        
        elements.append(toc_table)
        
        return elements
    
    def _create_introduction(self) -> List:
        """Create introduction section"""
        elements = []
        
        elements.append(Paragraph("1.0 INTRODUCTION", self.styles['SectionHeader']))
        
        intro_text = f"""
        <b>1.1 Purpose and Scope</b><br/>
        This geotechnical investigation was conducted to evaluate subsurface soil conditions 
        and provide foundation and earthwork recommendations for the proposed 
        {self.project_info.get('project_type', 'development')}. The scope of services included:
        <br/><br/>
        • Review of available geologic and geotechnical information<br/>
        • Field exploration including soil borings and in-situ testing<br/>
        • Laboratory testing of representative soil samples<br/>
        • Engineering analysis and preparation of this report
        <br/><br/>
        <b>1.2 Project Description</b><br/>
        The project consists of {self.project_info.get('description', 'proposed construction')} 
        at {self.project_info.get('location', 'the site location')}. Site coordinates are 
        approximately {self.project_info.get('coordinates', 'XX°XX\'XX" N, XX°XX\'XX" E')}.
        """
        
        elements.append(Paragraph(intro_text, self.styles['BodyJustify']))
        
        return elements
    
    def _create_field_investigation(self) -> List:
        """Create field investigation section"""
        elements = []
        
        elements.append(Paragraph("2.0 FIELD INVESTIGATION", self.styles['SectionHeader']))
        
        field_text = """
        <b>2.1 Exploration Methods</b><br/>
        Field exploration was performed using truck-mounted drill rig. Soil borings were 
        advanced to depths ranging from 15 to 25 feet below existing grade. Standard 
        Penetration Tests (SPT) were conducted in general accordance with ASTM D1586.
        <br/><br/>
        <b>2.2 Subsurface Conditions</b><br/>
        Subsurface materials encountered generally consisted of:<br/>
        • 0-2 ft: Topsoil and fill material<br/>
        • 2-8 ft: Silty clay (CL), medium stiff<br/>
        • 8-15 ft: Sandy silt (ML), dense<br/>
        • 15+ ft: Clayey sand (SC), very dense
        """
        
        elements.append(Paragraph(field_text, self.styles['BodyJustify']))
        
        return elements
    
    def _create_phase_section(self, data: Dict) -> List:
        """Create phase relationships section"""
        elements = []
        
        elements.append(Paragraph("3.1 Phase Relationships", self.styles['SubSection']))
        
        # Results table
        phase_data = [
            ['Parameter', 'Value', 'Unit'],
            ['Moisture Content (w)', f"{data.get('moisture_content', 'N/A')}", '%'],
            ['Bulk Unit Weight (γ)', f"{data.get('gamma_bulk', 'N/A')}", 'kN/m³'],
            ['Dry Unit Weight (γd)', f"{data.get('gamma_dry', 'N/A')}", 'kN/m³'],
            ['Void Ratio (e)', f"{data.get('void_ratio', 'N/A')}", '-'],
            ['Degree of Saturation (Sr)', f"{data.get('saturation', 'N/A')}", '%'],
        ]
        
        phase_table = Table(phase_data, colWidths=[3*inch, 1.5*inch, 1*inch])
        phase_table.setStyle(self._get_standard_table_style())
        
        elements.append(phase_table)
        elements.append(Spacer(1, 0.2*inch))
        
        return elements
    
    def _create_atterberg_section(self, data: Dict) -> List:
        """Create Atterberg limits section"""
        elements = []
        
        elements.append(Paragraph("3.2 Atterberg Limits (ASTM D4318)", self.styles['SubSection']))
        
        atterberg_text = f"""
        Atterberg limit tests were performed to classify fine-grained soils. 
        Results indicate soil classification as <b>{data.get('classification', 'N/A')}</b> 
        ({data.get('description', 'soil description')}).
        """
        elements.append(Paragraph(atterberg_text, self.styles['BodyJustify']))
        
        atterberg_data = [
            ['Parameter', 'Value'],
            ['Liquid Limit (LL)', f"{data.get('liquid_limit', 'N/A')}%"],
            ['Plastic Limit (PL)', f"{data.get('plastic_limit', 'N/A')}%"],
            ['Plasticity Index (PI)', f"{data.get('plasticity_index', 'N/A')}%"],
            ['USCS Classification', data.get('classification', 'N/A')],
        ]
        
        atterberg_table = Table(atterberg_data, colWidths=[3*inch, 2.5*inch])
        atterberg_table.setStyle(self._get_standard_table_style())
        
        elements.append(atterberg_table)
        elements.append(Spacer(1, 0.2*inch))
        
        return elements
    
    def _create_compaction_section(self, data: Dict) -> List:
        """Create compaction section"""
        elements = []
        
        elements.append(Paragraph("3.3 Compaction (ASTM D698/D1557)", self.styles['SubSection']))
        
        compaction_text = f"""
        {data.get('test_type', 'Standard').title()} Proctor compaction tests were performed 
        to determine optimum moisture-density relationships for earthwork quality control.
        """
        elements.append(Paragraph(compaction_text, self.styles['BodyJustify']))
        
        compaction_data = [
            ['Parameter', 'Value'],
            ['Maximum Dry Density (MDD)', f"{data.get('maximum_dry_density', 'N/A')} kN/m³"],
            ['Optimum Moisture Content (OMC)', f"{data.get('optimum_moisture_content', 'N/A')}%"],
            ['Test Method', data.get('test_type', 'Standard').title() + ' Proctor'],
        ]
        
        compaction_table = Table(compaction_data, colWidths=[3*inch, 2.5*inch])
        compaction_table.setStyle(self._get_standard_table_style())
        
        elements.append(compaction_table)
        elements.append(Spacer(1, 0.2*inch))
        
        return elements
    
    def _create_shear_section(self, data: Dict) -> List:
        """Create shear strength section"""
        elements = []
        
        elements.append(Paragraph("3.4 Shear Strength (ASTM D3080)", self.styles['SubSection']))
        
        shear_text = f"""
        Direct shear tests were performed to determine shear strength parameters. 
        Results are based on Mohr-Coulomb failure criterion.
        """
        elements.append(Paragraph(shear_text, self.styles['BodyJustify']))
        
        shear_data = [
            ['Parameter', 'Value'],
            ['Cohesion (c)', f"{data.get('cohesion', 'N/A')} kPa"],
            ['Friction Angle (φ)', f"{data.get('friction_angle', 'N/A')}°"],
            ['Test Type', data.get('test_type', 'Direct Shear')],
        ]
        
        shear_table = Table(shear_data, colWidths=[3*inch, 2.5*inch])
        shear_table.setStyle(self._get_standard_table_style())
        
        elements.append(shear_table)
        elements.append(Spacer(1, 0.2*inch))
        
        return elements
    
    def _create_consolidation_section(self, data: Dict) -> List:
        """Create consolidation section"""
        elements = []
        
        elements.append(Paragraph("3.5 Consolidation (ASTM D2435)", self.styles['SubSection']))
        
        consolidation_data = [
            ['Parameter', 'Value'],
            ['Compression Index (Cc)', f"{data.get('compression_index', 'N/A')}"],
            ['Recompression Index (Cr)', f"{data.get('recompression_index', 'N/A')}"],
            ['Preconsolidation Pressure (σ\'p)', f"{data.get('preconsolidation_pressure', 'N/A')} kPa"],
        ]
        
        consolidation_table = Table(consolidation_data, colWidths=[3*inch, 2.5*inch])
        consolidation_table.setStyle(self._get_standard_table_style())
        
        elements.append(consolidation_table)
        elements.append(Spacer(1, 0.2*inch))
        
        return elements
    
    def _create_bearing_section(self, data: Dict) -> List:
        """Create bearing capacity section"""
        elements = []
        
        elements.append(Paragraph("4.1 Bearing Capacity Analysis", self.styles['SubSection']))
        
        bearing_text = f"""
        Bearing capacity was calculated using {data.get('method', 'Terzaghi')} method 
        based on laboratory-determined strength parameters and foundation geometry.
        """
        elements.append(Paragraph(bearing_text, self.styles['BodyJustify']))
        
        bearing_data = [
            ['Parameter', 'Value'],
            ['Ultimate Bearing Capacity (qu)', f"{data.get('ultimate_bearing_capacity', 'N/A')} kPa"],
            ['Allowable Bearing Capacity (qa)', f"{data.get('allowable_bearing_capacity', 'N/A')} kPa"],
            ['Factor of Safety', '3.0'],
            ['Foundation Type', data.get('shape', 'Strip').title()],
        ]
        
        bearing_table = Table(bearing_data, colWidths=[3*inch, 2.5*inch])
        bearing_table.setStyle(self._get_standard_table_style())
        
        elements.append(bearing_table)
        elements.append(Spacer(1, 0.2*inch))
        
        return elements
    
    def _create_slope_section(self, data: Dict) -> List:
        """Create slope stability section"""
        elements = []
        
        elements.append(Paragraph("4.2 Slope Stability Analysis", self.styles['SubSection']))
        
        slope_text = f"""
        Slope stability was analyzed using {data.get('method', 'Simplified Bishop')} method. 
        Analysis indicates the slope is <b>{data.get('status', 'STABLE')}</b> with a 
        factor of safety of {data.get('factor_of_safety', 'N/A')}.
        """
        elements.append(Paragraph(slope_text, self.styles['BodyJustify']))
        
        slope_data = [
            ['Parameter', 'Value'],
            ['Factor of Safety (FoS)', f"{data.get('factor_of_safety', 'N/A')}"],
            ['Analysis Method', data.get('method', 'Simplified Bishop')],
            ['Status', data.get('status', 'N/A')],
        ]
        
        slope_table = Table(slope_data, colWidths=[3*inch, 2.5*inch])
        slope_table.setStyle(self._get_standard_table_style())
        
        elements.append(slope_table)
        elements.append(Spacer(1, 0.2*inch))
        
        return elements
    
    def _create_recommendations(self) -> List:
        """Create recommendations section"""
        elements = []
        
        elements.append(Paragraph("5.0 RECOMMENDATIONS", self.styles['SectionHeader']))
        
        recommendations_text = """
        <b>5.1 Foundation Design</b><br/>
        Spread footings may be designed using the allowable bearing capacity values provided. 
        Minimum embedment depth of 18 inches below final grade is recommended.
        <br/><br/>
        <b>5.2 Site Preparation</b><br/>
        • Strip and remove topsoil and organic materials<br/>
        • Proof-roll subgrade with heavy equipment<br/>
        • Repair soft/yielding areas with controlled fill<br/>
        • Compact fill to minimum 95% Standard Proctor
        <br/><br/>
        <b>5.3 Quality Control</b><br/>
        • Field density tests at 2-foot lift thickness<br/>
        • Minimum 95% relative compaction required<br/>
        • Moisture content within ±2% of optimum
        """
        
        elements.append(Paragraph(recommendations_text, self.styles['BodyJustify']))
        
        return elements
    
    def _create_appendix(self) -> List:
        """Create appendix section"""
        elements = []
        
        elements.append(Paragraph("APPENDIX A: Laboratory Test Results", self.styles['SectionHeader']))
        elements.append(Paragraph("Detailed laboratory test data sheets and boring logs are attached.", 
                                 self.styles['BodyJustify']))
        
        return elements
    
    def _get_standard_table_style(self) -> TableStyle:
        """Get standard table styling"""
        return TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#1f2937')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ])
    
    def _add_header_footer(self, canvas, doc):
        """Add header and footer to each page"""
        canvas.saveState()
        
        # Header
        canvas.setFont('Helvetica', 9)
        canvas.setFillColor(colors.HexColor('#6b7280'))
        canvas.drawString(
            72, 
            A4[1] - 50, 
            f"{self.project_info.get('project_name', 'Geotechnical Report')}"
        )
        
        # Footer
        canvas.drawString(72, 50, f"Project No: {self.project_info.get('project_no', 'XXXX-XX')}")
        canvas.drawRightString(A4[0] - 72, 50, f"Page {doc.page}")
        
        # Footer line
        canvas.setStrokeColor(colors.HexColor('#e5e7eb'))
        canvas.line(72, 60, A4[0] - 72, 60)
        
        canvas.restoreState()


def generate_report_pdf(project_info: Dict, test_results: Dict) -> bytes:
    """
    Convenience function to generate complete PDF report
    
    Args:
        project_info: Project metadata (name, location, client, etc.)
        test_results: Dict containing all test results
    
    Returns:
        PDF as bytes
    """
    report = GeotechnicalReport(project_info)
    
    return report.generate_complete_report(
        phase_data=test_results.get('phase'),
        atterberg_data=test_results.get('atterberg'),
        compaction_data=test_results.get('compaction'),
        shear_data=test_results.get('shear'),
        bearing_data=test_results.get('bearing'),
        consolidation_data=test_results.get('consolidation'),
        slope_data=test_results.get('slope'),
    )