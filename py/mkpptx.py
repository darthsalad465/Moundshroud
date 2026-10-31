"""Builds a clean 16:9 .pptx from a small JSON file: {"title": str, "subtitle": str, "slides": [{"title": str, "bullets": [str], "notes": str}], "out": path}"""
import json
import sys

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.util import Emu, Inches, Pt

BG = RGBColor(0x14, 0x17, 0x22)
TEXT = RGBColor(0xEC, 0xEE, 0xF5)
MUTE = RGBColor(0x9A, 0xA3, 0xBA)
ACC = RGBColor(0x8B, 0x7C, 0xFF)
ACC2 = RGBColor(0x46, 0xD7, 0xC8)


def paint(slide, prs):
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = BG
    bar = slide.shapes.add_shape(1, 0, 0, Emu(int(prs.slide_width * 0.012)), prs.slide_height)
    bar.fill.solid()
    bar.fill.fore_color.rgb = ACC
    bar.line.fill.background()


def style(tf, size, color, bold=False):
    for p in tf.paragraphs:
        for r in p.runs:
            r.font.size = Pt(size)
            r.font.color.rgb = color
            r.font.bold = bold
            r.font.name = "Segoe UI"


def main():
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)

    s = prs.slides.add_slide(prs.slide_layouts[0])
    paint(s, prs)
    s.shapes.title.text = str(spec.get("title") or "Presentation")[:90]
    s.shapes.title.left, s.shapes.title.top, s.shapes.title.width, s.shapes.title.height = Inches(1), Inches(2.4), Inches(11.3), Inches(1.6)
    style(s.shapes.title.text_frame, 44, TEXT, True)
    s.shapes.title.text_frame.paragraphs[0].alignment = 1
    sub = s.placeholders[1]
    sub.text = str(spec.get("subtitle") or "")[:140]
    sub.left, sub.top, sub.width, sub.height = Inches(1), Inches(4.1), Inches(11.3), Inches(1)
    style(sub.text_frame, 22, ACC2)
    sub.text_frame.paragraphs[0].alignment = 1

    for sl in (spec.get("slides") or [])[:20]:
        s = prs.slides.add_slide(prs.slide_layouts[1])
        paint(s, prs)
        t = s.shapes.title
        t.text = str(sl.get("title") or "")[:90]
        t.left, t.top, t.width, t.height = Inches(0.8), Inches(0.5), Inches(11.7), Inches(1.1)
        style(t.text_frame, 34, TEXT, True)
        body = s.placeholders[1]
        body.left, body.top, body.width, body.height = Inches(0.9), Inches(1.9), Inches(11.5), Inches(4.9)
        tf = body.text_frame
        tf.word_wrap = True
        bullets = [str(b)[:180] for b in (sl.get("bullets") or [])[:7]]
        for i, b in enumerate(bullets or [""]):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.text = b
            p.space_after = Pt(10)
        style(tf, 22 if len(bullets) <= 5 else 19, TEXT)
        if sl.get("notes"):
            s.notes_slide.notes_text_frame.text = str(sl["notes"])[:1500]
    prs.save(spec["out"])


main()
