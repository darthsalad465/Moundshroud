"""Fonts, as far as this sandbox can honour them: a family and a size, drawn with the one built-in face.

`font.nametofont`, `families`, `Font.measure` and `Font.metrics` all answer, so code that measures text before drawing
it still works.
"""

from . import _font, _font_px, _text_size, _num

FAMILIES = ['Helvetica', 'Arial', 'Courier', 'Times', 'Segoe UI', 'TkDefaultFont', 'TkTextFont', 'TkFixedFont']


class Font:
    def __init__(self, root=None, font=None, name=None, exists=False, **kw):
        spec = kw.get('font', font)
        self.family = str(kw.get('family') or (spec if isinstance(spec, str) else 'Helvetica'))
        self.size = _num(kw.get('size') or (spec[1] if isinstance(spec, (tuple, list)) and len(spec) > 1 else 0), 12)
        self.weight = str(kw.get('weight', 'normal'))
        self.slant = str(kw.get('slant', 'roman'))
        self.underline = bool(kw.get('underline', 0))
        self.overstrike = bool(kw.get('overstrike', 0))
        self._pil = _font(('x', self.size))

    def actual(self, *a):
        return {'family': self.family, 'size': self.size, 'weight': self.weight, 'slant': self.slant,
                'underline': self.underline, 'overstrike': self.overstrike}

    def cget(self, key):
        return getattr(self, str(key), '')

    def configure(self, **kw):
        for key, value in kw.items():
            if hasattr(self, str(key)):
                setattr(self, str(key), value)
        self._pil = _font(('x', self.size))

    config = configure

    def measure(self, text):
        return _text_size(str(text), self._pil)[0]

    def metrics(self, *a):
        width, height = _text_size('Ag', self._pil)
        return {'ascent': height, 'descent': max(1, height // 4), 'linespace': height + 2, 'fixed': 0}

    def copy(self):
        return Font(font=(self.family, self.size))


def families(root=None, displayof=None):
    return tuple(FAMILIES)


def names(root=None):
    return ('TkDefaultFont', 'TkTextFont', 'TkFixedFont', 'TkMenuFont')


_NAMED = {}


def nametofont(name, root=None):
    if name not in _NAMED:
        _NAMED[name] = Font(font=(name, 12))
    return _NAMED[name]
