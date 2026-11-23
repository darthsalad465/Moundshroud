"""A real pygame for the sandbox: it draws into a pixel buffer, and every frame becomes a picture.

Programs written for pygame run here unchanged for the things people actually write — a window, filling and blitting
surfaces (with true per-surface alpha and per-pixel alpha), rectangles, circles, ellipses, lines, arcs and polygons,
text in a real outline font, rotation and scaling, sprites, vectors, the event queue, the keyboard and the clock.
There is no window, no sound and no gamepad: display.flip()/update() keeps the frame, and the page shows the last few
frames under the output, so graphics are never invisible. A program that never stops is stopped by the frame limit
(180 frames by default, or whatever pygame.set_frame_limit(n) says): the event queue reports QUIT so an ordinary game
loop ends cleanly.
"""

import base64
import math
import math as _math
import struct
import sys
import types
import zlib
from collections import deque

import numpy as np

import sandbox_figures

__all__ = ['init', 'quit', 'get_error', 'set_error', 'error', 'display', 'draw', 'font', 'image', 'transform', 'event',
           'time', 'key', 'mouse', 'mixer', 'Surface', 'Rect', 'Color', 'sprite', 'math', 'version', 'get_sdl_version',
           'get_sdl_byteorder', 'set_frame_limit', 'frames', 'flush', 'QUIT', 'KEYDOWN', 'KEYUP', 'MOUSEBUTTONDOWN',
           'MOUSEBUTTONUP', 'MOUSEMOTION', 'VIDEORESIZE', 'ACTIVEEVENT', 'MOUSEWHEEL', 'SIZECHANGED', 'SRCALPHA',
           'HWSURFACE', 'DOUBLEBUF', 'FULLSCREEN', 'RESIZABLE', 'NOFRAME', 'SCALED']

version = types.SimpleNamespace(ver='2.5.2-sandbox', vernum=(2, 5, 2))

# ---------------------------------------------------------------- events and flags
QUIT, ACTIVEEVENT, KEYDOWN, KEYUP, MOUSEMOTION, MOUSEBUTTONDOWN, MOUSEBUTTONUP = 256, 1, 768, 769, 1024, 1025, 1026
MOUSEWHEEL, VIDEORESIZE, VIDEORESIZED, JOYBUTTONDOWN, NUMEVENTS, USEREVENT = 1027, 32769, 32770, 1539, 32866, 32867
SIZECHANGED = VIDEORESIZE
SWSURFACE, HWSURFACE, SRCALPHA, PREALLOC, FULLSCREEN, DOUBLEBUF, RESIZABLE, NOFRAME, SCALED = 0, 1, 1 << 16, 1 << 30, 1, 2, 16, 32, 1 << 9
NOEVENT, WINDOWSHOWN, WINDOWHIDDEN, WINDOWEXPOSED, WINDOWMOVED, WINDOWRESIZED = 0, 1, 2, 3, 4, 5
BLEND_ADD, BLEND_SUB, BLEND_MULT, BLEND_MIN, BLEND_MAX = 1, 2, 3, 4, 5

# ------------------------------------------------------------------------ keys
_KEYS = {
    'K_BACKSPACE': 8, 'K_TAB': 9, 'K_RETURN': 13, 'K_ENTER': 13, 'K_ESCAPE': 27, 'K_SPACE': 32, 'K_DELETE': 127,
    'K_LEFT': 1073741904, 'K_RIGHT': 1073741903, 'K_UP': 1073741906, 'K_DOWN': 1073741905,
    'K_HOME': 1073741898, 'K_END': 1073741901, 'K_PAGEUP': 1073741899, 'K_PAGEDOWN': 1073741902,
    'K_INSERT': 1073741897, 'K_LSHIFT': 1073742049, 'K_RSHIFT': 1073742053, 'K_LCTRL': 1073742048,
    'K_RCTRL': 1073742052, 'K_LALT': 1073742048 + 665, 'K_RALT': 1073742050,
    'K_F1': 1073741882, 'K_F2': 1073741883, 'K_F3': 1073741884, 'K_F4': 1073741885, 'K_F5': 1073741886,
    'K_F6': 1073741887, 'K_F7': 1073741888, 'K_F8': 1073741889, 'K_F9': 1073741890, 'K_F10': 1073741891,
    'K_F11': 1073741892, 'K_F12': 1073741893,
}
for _i in range(26):
    _KEYS['K_' + chr(97 + _i)] = 97 + _i
for _i in range(10):
    _KEYS['K_%d' % _i] = 48 + _i
globals().update(_KEYS)
# `from pygame.locals import *` should find the same names
_locals_mod = types.ModuleType('pygame.locals')
_locals_mod.__dict__.update(_KEYS)
_locals_mod.__dict__.update({'QUIT': QUIT, 'KEYDOWN': KEYDOWN, 'KEYUP': KEYUP, 'MOUSEMOTION': MOUSEMOTION,
                             'MOUSEBUTTONDOWN': MOUSEBUTTONDOWN, 'MOUSEBUTTONUP': MOUSEBUTTONUP,
                             'SRCALPHA': SRCALPHA, 'HWSURFACE': HWSURFACE, 'DOUBLEBUF': DOUBLEBUF,
                             'FULLSCREEN': FULLSCREEN, 'RESIZABLE': RESIZABLE, 'NOFRAME': NOFRAME, 'SCALED': SCALED},
                            )
_NAME_OF_KEY = {v: k[2:].lower() for k, v in _KEYS.items()}

NAMED_COLORS = {
    'black': (0, 0, 0), 'white': (255, 255, 255), 'red': (255, 0, 0), 'green': (0, 128, 0),
    'lime': (0, 255, 0), 'blue': (0, 0, 255), 'yellow': (255, 255, 0), 'orange': (255, 165, 0),
    'purple': (128, 0, 128), 'grey': (128, 128, 128), 'gray': (128, 128, 128), 'cyan': (0, 255, 255),
    'aqua': (0, 255, 255), 'magenta': (255, 0, 255), 'fuchsia': (255, 0, 255), 'pink': (255, 192, 203),
    'brown': (165, 42, 42), 'navy': (0, 0, 128), 'teal': (0, 128, 128), 'olive': (128, 128, 0),
    'silver': (192, 192, 192), 'maroon': (128, 0, 0), 'gold': (255, 215, 0), 'coral': (255, 127, 80),
    'salmon': (250, 128, 114), 'violet': (238, 130, 238), 'indigo': (75, 0, 130), 'ivory': (255, 255, 240),
    'khaki': (240, 230, 140), 'lavender': (230, 230, 250), 'skyblue': (135, 206, 235),
    'darkgreen': (0, 100, 0), 'darkblue': (0, 0, 139), 'darkred': (139, 0, 0), 'lightgray': (211, 211, 211),
    'lightgrey': (211, 211, 211), 'darkgray': (169, 169, 169), 'darkgrey': (169, 169, 169),
}


class error(RuntimeError):
    """pygame.error, so `except pygame.error:` works."""


_error_text = ''


def get_error():
    return _error_text


def set_error(text):
    global _error_text
    _error_text = str(text)


def init():
    return (6, 0)


def quit():
    return None


# --------------------------------------------------------------------- colours
def _rgba(color, alpha=255):
    """Any pygame colour (tuple, list, int, 'name', '#rrggbb', Color) -> (r, g, b, a) as ints 0-255."""
    if color is None:
        return (0, 0, 0, 255)
    if isinstance(color, Color):
        color = tuple(color)
    if isinstance(color, (str, bytes)):
        text = color.decode() if isinstance(color, bytes) else color
        key = text.strip().lower()
        if key in NAMED_COLORS:
            return NAMED_COLORS[key] + (alpha,)
        if key.startswith('#') and len(key) in (4, 7, 9):
            body = key[1:]
            if len(body) == 3:
                body = ''.join(ch * 2 for ch in body)
            try:
                parts = [int(body[i:i + 2], 16) for i in range(0, len(body), 2)]
            except ValueError:
                return (0, 0, 0, alpha)
            while len(parts) < 4:
                parts.append(alpha)
            return tuple(parts[:4])
        return (0, 0, 0, alpha)
    if isinstance(color, (int, float, np.integer)):
        v = int(max(0, min(255, color)))
        return (v, v, v, alpha)
    seq = list(color)
    while len(seq) < 3:
        seq.append(0)
    out = [int(max(0, min(255, v))) for v in seq[:4]]
    if len(out) == 3:
        out.append(alpha)
    return tuple(out)


class Color(tuple):
    """pygame.Color: a colour that can be unpacked, subscripted past its end, and compared with tuples."""

    def __new__(cls, *args):
        if len(args) == 1 and isinstance(args[0], (tuple, list, Color)):
            args = tuple(args[0])
        elif len(args) == 1 and isinstance(args[0], str):
            args = _rgba(args[0])[:3]
        return tuple.__new__(cls, _rgba(tuple(args) if args else (0, 0, 0)))

    def __getitem__(self, i):
        try:
            return tuple.__getitem__(self, i)
        except IndexError:
            return 255

    def __repr__(self):
        return 'Color(%d, %d, %d, %d)' % tuple(self)

    @property
    def r(self):
        return self[0]

    @property
    def g(self):
        return self[1]

    @property
    def b(self):
        return self[2]

    @property
    def a(self):
        return self[3]

    def lerp(self, other, amount):
        other = _rgba(other)
        return Color(tuple(int(round(self[i] + (other[i] - self[i]) * float(amount))) for i in range(4)))

    def correct_gamma(self, gamma):
        return self

    def normalize(self):
        return tuple(round(v / 255.0, 4) for v in self)

    def hsva(self):
        r, g, b = self[0] / 255.0, self[1] / 255.0, self[2] / 255.0
        high, low = max(r, g, b), min(r, g, b)
        delta = high - low
        if delta == 0:
            hue = 0.0
        elif high == r:
            hue = (60 * ((g - b) / delta)) % 360
        elif high == g:
            hue = 60 * ((b - r) / delta) + 120
        else:
            hue = 60 * ((r - g) / delta) + 240
        sat = 0 if high == 0 else delta / high
        return (hue, sat, high, self[3] / 255.0)


# ------------------------------------------------------------------------ Rect
class Rect:
    """pygame.Rect with the attributes, arithmetic and collision tests most programs use."""

    def __init__(self, *args):
        if not args:
            vals = (0, 0, 0, 0)
        elif len(args) == 1:
            one = args[0]
            if isinstance(one, Rect):
                vals = (one.x, one.y, one.w, one.h)
            elif isinstance(one, (tuple, list)):
                seq = list(one)
                if len(seq) == 1:
                    seq = [0, 0, seq[0], seq[0]]
                vals = tuple(seq[:4]) + (0,) * max(0, 4 - len(seq[:4]))
            elif hasattr(one, 'rect'):
                r = one.rect
                vals = (r.x, r.y, r.w, r.h)
            else:
                vals = (0, 0, 0, 0)
        else:
            vals = tuple(list(args)[:4]) + (0,) * max(0, 4 - len(args))
        self.x, self.y, self.w, self.h = (int(round(float(v))) for v in vals[:4])

    # tuple behaviour
    def __iter__(self):
        return iter((self.x, self.y, self.w, self.h))

    def __len__(self):
        return 4

    def __getitem__(self, i):
        return (self.x, self.y, self.w, self.h)[i]

    def __eq__(self, other):
        try:
            return tuple(self) == tuple(other)
        except TypeError:
            return NotImplemented

    def __hash__(self):
        return hash(tuple(self))

    def __repr__(self):
        return '<rect(%d, %d, %d, %d)>' % (self.x, self.y, self.w, self.h)

    def __bool__(self):
        return self.w != 0 and self.h != 0

    def copy(self):
        return Rect(self.x, self.y, self.w, self.h)

    # geometry
    @property
    def left(self):
        return self.x

    @left.setter
    def left(self, v):
        self.x = int(v)

    @property
    def top(self):
        return self.y

    @top.setter
    def top(self, v):
        self.y = int(v)

    @property
    def right(self):
        return self.x + self.w

    @right.setter
    def right(self, v):
        self.x = int(v) - self.w

    @property
    def bottom(self):
        return self.y + self.h

    @bottom.setter
    def bottom(self, v):
        self.y = int(v) - self.h

    @property
    def centerx(self):
        return self.x + self.w // 2

    @centerx.setter
    def centerx(self, v):
        self.x = int(v) - self.w // 2

    @property
    def centery(self):
        return self.y + self.h // 2

    @centery.setter
    def centery(self, v):
        self.y = int(v) - self.h // 2

    def _get_center(self):
        return (self.x + self.w // 2, self.y + self.h // 2)

    def _set_center(self, v):
        self.centerx, self.centery = int(v[0]), int(v[1])

    center = property(_get_center, _set_center)

    @property
    def topleft(self):
        return (self.x, self.y)

    @topleft.setter
    def topleft(self, v):
        self.x, self.y = int(v[0]), int(v[1])

    @property
    def topright(self):
        return (self.x + self.w, self.y)

    @topright.setter
    def topright(self, v):
        self.x, self.y = int(v[0]) - self.w, int(v[1])

    @property
    def bottomleft(self):
        return (self.x, self.y + self.h)

    @bottomleft.setter
    def bottomleft(self, v):
        self.x, self.y = int(v[0]), int(v[1]) - self.h

    @property
    def bottomright(self):
        return (self.x + self.w, self.y + self.h)

    @bottomright.setter
    def bottomright(self, v):
        self.x, self.y = int(v[0]) - self.w, int(v[1]) - self.h

    @property
    def midtop(self):
        return (self.x + self.w // 2, self.y)

    @midtop.setter
    def midtop(self, v):
        self.centerx, self.top = int(v[0]), int(v[1])

    @property
    def midbottom(self):
        return (self.x + self.w // 2, self.y + self.h)

    @midbottom.setter
    def midbottom(self, v):
        self.centerx, self.bottom = int(v[0]), int(v[1])

    @property
    def midleft(self):
        return (self.x, self.y + self.h // 2)

    @midleft.setter
    def midleft(self, v):
        self.left, self.centery = int(v[0]), int(v[1])

    @property
    def midright(self):
        return (self.x + self.w, self.y + self.h // 2)

    @midright.setter
    def midright(self, v):
        self.right, self.centery = int(v[0]), int(v[1])

    @property
    def size(self):
        return (self.w, self.h)

    @size.setter
    def size(self, v):
        self.w, self.h = int(v[0]), int(v[1])

    @property
    def width(self):
        return self.w

    @width.setter
    def width(self, v):
        self.w = int(v)

    @property
    def height(self):
        return self.h

    @height.setter
    def height(self, v):
        self.h = int(v)

    def move(self, dx, dy):
        return Rect(self.x + int(dx), self.y + int(dy), self.w, self.h)

    def move_ip(self, dx, dy):
        self.x += int(dx)
        self.y += int(dy)

    def inflate(self, dx, dy):
        return Rect(self.x - int(dx) // 2, self.y - int(dy) // 2, self.w + int(dx), self.h + int(dy))

    def inflate_ip(self, dx, dy):
        self.x -= int(dx) // 2
        self.y -= int(dy) // 2
        self.w += int(dx)
        self.h += int(dy)

    def clamp(self, other):
        other = Rect(other)
        return Rect(min(max(self.x, other.x), other.x + other.w - self.w),
                    min(max(self.y, other.y), other.y + other.h - self.h), self.w, self.h)

    def clamp_ip(self, other):
        self.x, self.y, _, _ = tuple(self.clamp(other))

    def clip(self, other):
        other = Rect(other)
        x0, y0 = max(self.x, other.x), max(self.y, other.y)
        x1 = min(self.x + self.w, other.x + other.w)
        y1 = min(self.y + self.h, other.y + other.h)
        if x1 <= x0 or y1 <= y0:
            return Rect(self.x, self.y, 0, 0)
        return Rect(x0, y0, x1 - x0, y1 - y0)

    def union(self, other):
        other = Rect(other)
        x0, y0 = min(self.x, other.x), min(self.y, other.y)
        x1 = max(self.x + self.w, other.x + other.w)
        y1 = max(self.y + self.h, other.y + other.h)
        return Rect(x0, y0, x1 - x0, y1 - y0)

    def union_ip(self, other):
        self.x, self.y, self.w, self.h = tuple(self.union(other))

    def colliderect(self, other):
        other = Rect(other)
        return not (self.x + self.w <= other.x or other.x + other.w <= self.x or
                    self.y + self.h <= other.y or other.y + other.h <= self.y)

    def collidelist(self, rects):
        for i, r in enumerate(rects):
            if self.colliderect(r):
                return i
        return -1

    def collidelistall(self, rects):
        return [i for i, r in enumerate(rects) if self.colliderect(r)]

    def collidepoint(self, *args):
        p = args[0] if len(args) == 1 else args
        if isinstance(p, Rect):
            p = (p.x, p.y)
        return self.x <= p[0] < self.x + self.w and self.y <= p[1] < self.y + self.h

    def collidedict(self, d):
        for key, value in d.items():
            if self.colliderect(value if isinstance(value, Rect) else key):
                return (key, value)
        return None

    def contains(self, other):
        other = Rect(other)
        return (self.x <= other.x and self.y <= other.y and
                other.x + other.w <= self.x + self.w and other.y + other.h <= self.y + self.h)

    def fit(self, other):
        """A rect with the same aspect ratio as other that fits inside self."""
        other = Rect(other)
        if not other.w or not other.h:
            return Rect(self.x, self.y, 1, 1)
        scale = min(self.w / other.w, self.h / other.h)
        w, h = max(1, int(other.w * scale)), max(1, int(other.h * scale))
        return Rect(self.x + (self.w - w) // 2, self.y + (self.h - h) // 2, w, h)


def rect(*a, **k):
    if k:
        r = Rect(k.get('left', 0), k.get('top', 0), k.get('width', k.get('w', 0)), k.get('height', k.get('h', 0)))
        for name in ('center', 'topleft', 'topright', 'bottomleft', 'bottomright', 'midtop', 'midbottom'):
            if name in k:
                setattr(r, name, k[name])
        return r
    return Rect(*a)


# -------------------------------------------------------------------- blending
_FADE = {}


def _fade_tables(alpha, rgb):
    """A byte table for `dst * (1 - a) + rgb * a` at a fixed alpha, so a fade is one lookup and one add."""
    key = (alpha, rgb)
    table = _FADE.get(key)
    if table is None:
        inv = 255 - alpha
        bottom = (np.arange(256, dtype=np.uint32) * inv // 255).astype(np.uint8)
        top = np.array([(int(c) * alpha) // 255 for c in rgb], dtype=np.uint8)
        table = (bottom, top)
        if len(_FADE) > 32:
            _FADE.clear()
        _FADE[key] = table
    return table


def _blend_solid(dst, x, y, w, h, rgb, alpha):
    """Fill dst[y:y+h, x:x+w] with rgb at alpha (0-255), clipped to the surface and blended."""
    if w <= 0 or h <= 0 or alpha <= 0:
        return
    sw, sh = dst.shape[1], dst.shape[0]
    x0, y0 = max(0, int(x)), max(0, int(y))
    x1, y1 = min(sw, int(x) + int(w)), min(sh, int(y) + int(h))
    if x1 <= x0 or y1 <= y0:
        return
    part = dst[y0:y1, x0:x1]
    if alpha >= 255:
        part[..., 0], part[..., 1], part[..., 2] = rgb
        part[..., 3] = 255
        return
    bottom, top = _fade_tables(alpha, rgb)
    part[..., :3] = bottom[part[..., :3]] + top
    part[..., 3] = np.maximum(part[..., 3], alpha)


def _blend_coverage(dst, x, y, coverage, rgb, alpha):
    """Blend rgb over dst where coverage (0-255, same size as dst clip) says so."""
    if alpha <= 0:
        return
    cov = coverage
    if alpha < 255:
        cov = (cov.astype(np.uint16) * alpha // 255).astype(np.uint8)
    if not cov.any():
        return
    d = dst[y:y + cov.shape[0], x:x + cov.shape[1]]
    a = cov.astype(np.uint16)[:, :, None]
    d[..., :3] = ((d[..., :3].astype(np.uint16) * (255 - a) + np.array(rgb, dtype=np.uint16) * a) // 255).astype(np.uint8)
    d[..., 3] = np.maximum(d[..., 3], cov)


# --------------------------------------------------------------------- Surface
class Surface:
    """A pixel buffer. It holds RGBA bytes, so fills, blits, alpha and drawing all behave like pygame."""

    def __init__(self, size, flags=0, depth=0, masks=None):
        if isinstance(size, Surface):
            self.width, self.height = size.width, size.height
        elif isinstance(size, (tuple, list)):
            self.width, self.height = int(size[0]), int(size[1])
        else:
            self.width = self.height = int(size)
        self.width = max(0, self.width)
        self.height = max(0, self.height)
        self.buf = np.zeros((self.height, self.width, 4), dtype=np.uint8)
        self._alpha = 255
        self._colorkey = None
        self._flags = flags
        # (r, g, b, a) while the whole surface is one solid colour, else None. Blitting a solid surface is one
        # vectorised pass instead of a full alpha blend, which is what makes full-screen fades cheap.
        self._solid = (0, 0, 0, 0)

    # -- basic information
    def get_size(self):
        return (self.width, self.height)

    size = property(get_size, lambda self, v: None)

    def get_width(self):
        return self.width

    def get_height(self):
        return self.height

    def get_rect(self, **kw):
        r = Rect(0, 0, self.width, self.height)
        for key, value in kw.items():
            setattr(r, key, value)
        return r

    @property
    def rect(self):
        return Rect(0, 0, self.width, self.height)

    def get_bounding_rect(self, min_alpha=1):
        if not self.buf.any():
            return Rect(0, 0, 0, 0)
        rows = np.where(self.buf[..., 3].max(axis=1) >= min_alpha)[0]
        cols = np.where(self.buf[..., 3].max(axis=0) >= min_alpha)[0]
        if not len(rows) or not len(cols):
            return Rect(0, 0, 0, 0)
        return Rect(int(cols[0]), int(rows[0]), int(cols[-1] - cols[0] + 1), int(rows[-1] - rows[0] + 1))

    def get_flags(self):
        return self._flags

    def get_bitsize(self):
        return 32

    def get_bytesize(self):
        return 4

    def get_masks(self):
        return (0xFF000000, 0x00FF0000, 0x0000FF00, 0x000000FF)

    def get_shifts(self):
        return (24, 16, 8, 0)

    def get_pitch(self):
        return self.width * 4

    def get_at(self, pos):
        x, y = int(pos[0]), int(pos[1])
        if 0 <= x < self.width and 0 <= y < self.height:
            return tuple(int(v) for v in self.buf[y, x])
        return (0, 0, 0, 255)

    def set_at(self, pos, color):
        x, y = int(pos[0]), int(pos[1])
        if 0 <= x < self.width and 0 <= y < self.height:
            self.buf[y, x] = _rgba(color)
            self._solid = None

    def get_colorkey(self):
        return self._colorkey

    def set_colorkey(self, color, flags=0):
        """A colour that becomes transparent when this surface is blitted."""
        self._colorkey = None if color is None else tuple(_rgba(color)[:3])
        if self._colorkey is not None:
            r, g, b = self._colorkey
            mask = (self.buf[..., 0] == r) & (self.buf[..., 1] == g) & (self.buf[..., 2] == b)
            self.buf[..., 3][mask] = 0
            self._solid = None
        return 0

    def get_alpha(self):
        return None if self._alpha == 255 else self._alpha

    def set_alpha(self, value, flags=0):
        """A global transparency for the whole surface, as pygame's set_alpha does."""
        if value is None:
            self._alpha = 255
        else:
            self._alpha = int(max(0, min(255, value)))
        return 0

    def get_bounding_rects(self):
        r = self.get_bounding_rect()
        return [r] if r.w and r.h else []

    def lock(self):
        return None

    def unlock(self):
        return None

    def mustlock(self):
        return False

    # -- drawing
    def fill(self, color, rect=None, special_flags=0):
        rgba = _rgba(color)
        if rect is None:
            area = Rect(0, 0, self.width, self.height)
        else:
            area = Rect(rect)
            if area.w <= 0 or area.h <= 0:
                area = Rect(0, 0, self.width, self.height)
        _blend_solid(self.buf, area.x, area.y, area.w, area.h, rgba[:3], rgba[3])
        if area.x <= 0 and area.y <= 0 and area.w >= self.width and area.h >= self.height and rgba[3] >= 255:
            self._solid = rgba
        else:
            self._solid = None
        return area

    def blit(self, source, dest, area=None, special_flags=0):
        if isinstance(dest, (tuple, list)):
            x, y = int(dest[0]), int(dest[1])
        else:
            x, y = int(dest.x), int(dest.y)
        if not isinstance(source, Surface):
            return Rect(x, y, 0, 0)
        return self._blit_one(source, x, y)

    def blits(self, sequence, doreturn=True):
        out = []
        for item in sequence:
            src = item[0]
            pos = item[1]
            if not isinstance(src, Surface):
                out.append(None)
                continue
            x = int(pos[0]) if isinstance(pos, (tuple, list)) else int(pos.x)
            y = int(pos[1]) if isinstance(pos, (tuple, list)) else int(pos.y)
            out.append(self._blit_one(src, x, y))
        return out if doreturn else None

    def _blit_one(self, source, x, y):
        sw, sh = source.width, source.height
        if sw <= 0 or sh <= 0 or self.width <= 0 or self.height <= 0:
            return Rect(x, y, sw, sh)
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(self.width, x + sw), min(self.height, y + sh)
        if x1 <= x0 or y1 <= y0:
            return Rect(x, y, sw, sh)
        alpha = source._alpha
        if alpha <= 0:
            return Rect(x, y, sw, sh)
        self._solid = None
        if source._solid is not None:
            r, g, b, a = source._solid
            _blend_solid(self.buf, x0, y0, x1 - x0, y1 - y0, (r, g, b), a * alpha // 255)
            return Rect(x, y, sw, sh)
        piece = source.buf[y0 - y:y1 - y, x0 - x:x1 - x]
        dst = self.buf[y0:y1, x0:x1]
        if alpha >= 255 and piece[..., 3].min() == 255:
            dst[:] = piece
        else:
            cov = piece[..., 3].copy()
            if alpha < 255:
                cov = (cov.astype(np.uint16) * alpha // 255).astype(np.uint8)
            if cov.any():
                a = cov.astype(np.uint16)[:, :, None]
                dst[..., :3] = ((dst[..., :3].astype(np.uint16) * (255 - a) +
                                 piece[..., :3].astype(np.uint16) * a) // 255).astype(np.uint8)
                dst[..., 3] = np.maximum(dst[..., 3], cov)
        return Rect(x, y, sw, sh)

    def copy(self):
        s = Surface((self.width, self.height))
        s.buf[:] = self.buf
        s._alpha = self._alpha
        s._colorkey = self._colorkey
        s._solid = self._solid
        return s

    def convert(self, *a):
        return self

    def convert_alpha(self, *a):
        return self

    def subsurface(self, *a):
        area = Rect(*a)
        x0, y0 = max(0, area.x), max(0, area.y)
        x1 = min(self.width, area.x + area.w)
        y1 = min(self.height, area.y + area.h)
        s = Surface((max(0, x1 - x0), max(0, y1 - y0)))
        if s.width and s.height:
            s.buf[:] = self.buf[y0:y1, x0:x1]
        return s

    def scroll(self, dx=0, dy=0):
        dx, dy = int(dx), int(dy)
        out = self.buf.copy()
        self.buf[:] = 0
        dst = self.buf
        xs0, xs1 = max(0, dx), min(self.width, self.width + dx)
        ys0, ys1 = max(0, dy), min(self.height, self.height + dy)
        if xs1 > xs0 and ys1 > ys0:
            dst[ys0:ys1, xs0:xs1] = out[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
        self._solid = None

    def set_clip(self, rect):
        return None

    def get_clip(self):
        return Rect(0, 0, self.width, self.height)

    def make_surface(self):
        return self

    def __repr__(self):
        return '<Surface(%dx%dx32)>' % (self.width, self.height)


# -------------------------------------------------------------------- display
class _Display:
    _surface = None
    _caption = ''
    _init = False

    def init(self):
        _Display._init = True
        return None

    def quit(self):
        _Display._init = False

    def get_init(self):
        return _Display._init

    def set_mode(self, size=(640, 480), flags=0, depth=0, display=0, vsync=0):
        if isinstance(size, Surface):
            _Display._surface = size
        else:
            _Display._surface = Surface((max(1, int(size[0])), max(1, int(size[1]))), flags)
        _Display._surface.fill((0, 0, 0))
        return _Display._surface

    def get_surface(self):
        if _Display._surface is None:
            _Display._surface = Surface((640, 480))
        return _Display._surface

    def set_caption(self, title='', icontitle=None):
        _Display._caption = str(title)

    def get_caption(self):
        return _Display._caption

    def set_icon(self, icon=None):
        return None

    def get_window_size(self):
        s = self.get_surface()
        return (s.width, s.height)

    def set_window_size(self, size):
        return None

    def flip(self):
        _frame('display.flip')

    def update(self, *a):
        _frame('display.update')

    def toggle_fullscreen(self, *a):
        return 1

    def set_fullscreen(self, *a):
        return 1

    def get_driver(self):
        return 'sandbox'

    def get_active(self):
        return True

    def get_num_displays(self):
        return 1


display = _Display()


# --------------------------------------------------------------- frame capture
MAX_FRAMES = 180
_frames = 0
_quit_sent = False
FRAMES = deque(maxlen=8)


def set_frame_limit(n):
    """How many frames may be drawn before the loop is stopped (default 180)."""
    global MAX_FRAMES
    MAX_FRAMES = max(1, int(n))


def frames():
    return _frames


def _frame(title):
    global _frames, _quit_sent
    _frames += 1
    if _frames <= MAX_FRAMES * 2:
        FRAMES.append((_frames, display.get_surface().buf.copy()))
    if _frames >= MAX_FRAMES:
        _quit_sent = True
    if _frames >= MAX_FRAMES * 2:
        raise error('pygame stopped after %d frames so the sandbox stays quick. Draw fewer frames, or call '
                    'pygame.set_frame_limit(n) before the loop.' % MAX_FRAMES)


def _png(arr):
    h, w = arr.shape[:2]
    raw = np.zeros((h, w * 4 + 1), dtype=np.uint8)
    raw[:, 1:] = arr.reshape(h, w * 4)
    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xFFFFFFFF)
    header = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(raw.tobytes(), 3)) +
            chunk(b'IEND', b''))


def flush():
    """Turn the frames kept during the run into pictures the page can show. Called when the program ends."""
    out = 0
    kept = list(FRAMES)
    FRAMES.clear()
    for number, buf in kept:
        try:
            sandbox_figures.add(base64.b64encode(_png(buf)).decode(), 'frame %d' % number)
            out += 1
        except Exception:
            break
    return out


# ---------------------------------------------------------------------- events
class _Event:
    """An event object: `.type` plus whatever fields the event has."""

    def __init__(self, type, **kw):
        self.type = int(type)
        self.dict = dict(kw)
        for key, value in kw.items():
            setattr(self, key, value)

    def __repr__(self):
        return '<Event(%d %s)>' % (self.type, self.dict)


class _EventModule:
    @staticmethod
    def get(*types, **kw):
        return _pump(types)

    @staticmethod
    def get_blocked(*a):
        return []

    @staticmethod
    def wait(timeout=0):
        """There is no real key or mouse to wait for, so this reports the end of the run instead of hanging."""
        pending = _pump(())
        return pending[0] if pending else _Event(NOEVENT)

    @staticmethod
    def peek(*types, **kw):
        return bool(_quit_sent) or bool(_pending)

    @staticmethod
    def poll():
        if _pending:
            return _pending.popleft()
        if _quit_sent:
            return _Event(QUIT)
        return _Event(NOEVENT)

    @staticmethod
    def post(event):
        _pending.append(event)

    @staticmethod
    def clear(*types, **kw):
        _pending.clear()

    @staticmethod
    def pump():
        _flush_input()

    @staticmethod
    def set_grab(value):
        return None

    @staticmethod
    def get_grab():
        return False

    @staticmethod
    def set_allowed(*a):
        return None

    @staticmethod
    def set_blocked(*a):
        return None

    @staticmethod
    def get_blocked(*a):
        return []

    @staticmethod
    def event_name(type):
        names = {QUIT: 'Quit', KEYDOWN: 'KeyDown', KEYUP: 'KeyUp', MOUSEMOTION: 'MouseMotion',
                 MOUSEBUTTONDOWN: 'MouseButtonDown', MOUSEBUTTONUP: 'MouseButtonUp', MOUSEWHEEL: 'MouseWheel'}
        return names.get(type, 'Unknown')

    @staticmethod
    def custom_type():
        global USEREVENT
        USEREVENT += 1
        return USEREVENT


event = _EventModule()
_pending = deque()
_input_line = ''


def _flush_input():
    """Anything typed into the program's Input box arrives as KEYDOWN events, then Enter."""
    global _input_line
    if not _input_line:
        return
    text, _input_line = _input_line, ''
    for ch in text:
        _pending.append(_Event(KEYDOWN, key=ord(ch), unicode=ch, mod=0, scancode=0))
    _pending.append(_Event(KEYDOWN, key=K_RETURN, unicode='\r', mod=0, scancode=40))


def _pump(types):
    _flush_input()
    out = []
    while _pending:
        out.append(_pending.popleft())
    if _quit_sent:
        out.append(_Event(QUIT))
    if types:
        types = tuple(types)
        out = [e for e in out if e.type in types]
    return out


# -------------------------------------------------------------------- keyboard
class _PressedKeys:
    """keys.get_pressed() -> something you can ask `keys[pygame.K_LEFT]` and iterate over."""

    def __getitem__(self, k):
        return False

    def __len__(self):
        return 512

    def __iter__(self):
        return iter([False] * 512)

    def __eq__(self, other):
        return False


class _KeyModule:
    @staticmethod
    def get_pressed():
        return _PressedKeys()

    @staticmethod
    def get_mods():
        return 0

    @staticmethod
    def set_mods(value):
        return None

    @staticmethod
    def get_focused():
        return True

    @staticmethod
    def get_repeat():
        return (0, 0)

    @staticmethod
    def set_repeat(*a):
        return None

    @staticmethod
    def name(key):
        return _NAME_OF_KEY.get(int(key), 'unknown key')

    @staticmethod
    def key_code(name):
        for key, label in _NAME_OF_KEY.items():
            if label == str(name):
                return key
        return -1


key = _KeyModule()
for _k, _v in _KEYS.items():
    setattr(key, _k, _v)


class _MouseModule:
    pos = (0, 0)
    visible = False
    focused = True

    def get_pos(self):
        return _MouseModule.pos

    def get_rel(self):
        return (0, 0)

    def set_pos(self, pos):
        _MouseModule.pos = (int(pos[0]), int(pos[1]))

    def get_pressed(self, num_buttons=3):
        return tuple([False] * max(1, int(num_buttons)))

    def set_visible(self, value):
        _MouseModule.visible = bool(value)
        return 0

    def get_visible(self):
        return _MouseModule.visible

    def get_focused(self):
        return True

    def set_cursor(self, *a):
        return None


mouse = _MouseModule()


class _TimeModule:
    class Clock:
        def __init__(self):
            self._fps = 0.0
            self._last = 0
            self._started = 0

        def tick(self, framerate=0):
            if framerate:
                self._fps = float(framerate)
            self._last = int(1000.0 / max(1.0, self._fps or 60.0))
            return self._last

        tick_busy_loop = tick

        def get_time(self):
            return self._last

        def get_rawtime(self):
            return self._last

        def get_fps(self):
            return float(self._fps or 60.0)

    def delay(self, ms):
        return int(ms)

    wait = delay

    def get_ticks(self):
        return _frames * 16

    def set_timer(self, *a, **kw):
        return None


time = _TimeModule()


class _MixerSound:
    def __init__(self, *a, **k):
        self._volume = 1.0

    def play(self, *a, **k):
        return _Channel()

    def stop(self):
        return None

    def fadeout(self, ms=0):
        return None

    def set_volume(self, volume):
        self._volume = float(volume)

    def get_volume(self):
        return self._volume

    def get_length(self):
        return 0.0

    def get_num_channels(self):
        return 0

    def set_num_channels(self, n):
        return None


class _Channel:
    def play(self, *a, **k):
        return None

    def stop(self):
        return None

    def set_volume(self, v):
        return None

    def get_busy(self):
        return False


class _MusicModule:
    def load(self, *a, **k):
        return None

    def play(self, *a, **k):
        return None

    def stop(self):
        return None

    def pause(self):
        return None

    def unpause(self):
        return None

    def set_volume(self, v):
        return None

    def get_busy(self):
        return False

    def fadeout(self, ms=0):
        return None

    def queue(self, *a, **k):
        return None


class _MixerModule:
    music = _MusicModule()

    def init(self, *a, **k):
        return None

    def pre_init(self, *a, **k):
        return None

    def quit(self):
        return None

    def get_init(self):
        return (44100, -16, 2)

    def set_num_channels(self, n):
        return None

    def get_num_channels(self):
        return 8

    def stop(self):
        return None

    def pause(self):
        return None

    def unpause(self):
        return None

    def Sound(self, *a, **k):
        return _MixerSound()

    def Channel(self, *a, **k):
        return _Channel()


mixer = _MixerModule()


# ----------------------------------------------------------------------- fonts
_TEXT_BACKEND = {}


def _textpath_module():
    """matplotlib draws the letters; it bundles DejaVu, so text has real outlines and real widths."""
    if 'mod' in _TEXT_BACKEND:
        return _TEXT_BACKEND['mod']
    try:
        from matplotlib.font_manager import FontProperties
        from matplotlib.textpath import TextPath
        _TEXT_BACKEND['mod'] = (TextPath, FontProperties)
    except Exception:
        _TEXT_BACKEND['mod'] = None
    return _TEXT_BACKEND['mod']


def _props(bold, italic):
    mod = _textpath_module()
    if not mod:
        return None
    _, FontProperties = mod
    return FontProperties(family='DejaVu Sans', weight='bold' if bold else 'normal',
                          style='italic' if italic else 'normal')


_METRICS = {}
_MASKS = {}
_FONT_FILE = {}
_GLYPHS = {}


def _font_file():
    '''The outline font matplotlib draws with, or None.'''
    if 'path' not in _FONT_FILE:
        path = None
        try:
            from matplotlib.font_manager import FontProperties, findfont
            path = findfont(FontProperties(family='DejaVu Sans'))
        except Exception:
            path = None
        _FONT_FILE['path'] = path
        _FONT_FILE['face'] = None
    return _FONT_FILE['path']


def _has_glyph(ch):
    '''True when the bundled font actually has a picture for this character.'''
    if ch in _GLYPHS:
        return _GLYPHS[ch]
    ok = True
    if not ch.isspace():
        path = _font_file()
        if path:
            try:
                if _FONT_FILE['face'] is None:
                    from matplotlib.ft2font import FT2Font
                    _FONT_FILE['face'] = FT2Font(path)
                ok = _FONT_FILE['face'].get_char_index(ord(ch)) != 0
            except Exception:
                ok = True
    _GLYPHS[ch] = ok
    return ok


def _missing_glyph(text):
    return any(not _has_glyph(ch) for ch in str(text))


def _font_metrics(size, bold, italic):
    """(ascent rows, descent rows) in pixels, measured once per size from a probe string."""
    k = (size, bold, italic)
    if k in _METRICS:
        return _METRICS[k]
    top, bottom = float(size) * 0.78, float(size) * 0.22
    mod = _textpath_module()
    if mod:
        TextPath, _ = mod
        try:
            probe = TextPath((0, 0), 'Hxpqgjy', size=float(size), prop=_props(bold, italic))
            ext = probe.get_extents()
            if ext.height > 0:
                top = max(top, ext.y1 + 1)
                bottom = max(bottom, -ext.y0 + 1)
        except Exception:
            pass
    metrics = (int(math.ceil(top)), int(math.ceil(bottom)))
    _METRICS[k] = metrics
    return metrics


def _text_mask(text, size, bold=False, italic=False):
    """Coverage (0-255) for a line of text, plus the width pygame would report for it."""
    k = (text, float(size), bold, italic)
    if k in _MASKS:
        return _MASKS[k]
    ascent, descent = _font_metrics(size, bold, italic)
    height = max(1, ascent + descent)
    left, right = 0.0, 0.0
    mod = _textpath_module()
    if not text:
        mask = np.zeros((height, 1), dtype=np.uint8)
        _MASKS[k] = (mask, 1)
        return _MASKS[k]
    if mod:
        TextPath, _ = mod
        try:
            path = TextPath((0, 0), text, size=float(size), prop=_props(bold, italic))
            ext = path.get_extents()
            left, right = float(ext.x0), float(ext.x1)
        except Exception:
            path = None
    else:
        path = None
    width = max(1, int(math.ceil(max(right, 0) - min(left, 0))) + 1)
    mask = np.zeros((height, width), dtype=np.uint8)
    if path is not None and right > left:
        ss = 2
        xs = np.arange(width * ss) / ss + 0.5 / ss
        ys = np.arange(height * ss) / ss + 0.5 / ss
        gx, gy = np.meshgrid(xs, (ascent - 1) - ys)
        points = np.column_stack([gx.ravel() + min(left, 0), gy.ravel()])
        try:
            inside = path.contains_points(points).reshape(height * ss, width * ss)
        except Exception:
            inside = None
        if inside is not None and inside.any():
            mask = (inside.reshape(height, ss, width, ss).mean(axis=(1, 3)) * 255).astype(np.uint8)
    if text.strip() and _missing_glyph(text):
        # the bundled font has no picture for this letter (Japanese, for example): draw a hollow box, which is
        # honest about it and still gives the program something visible to move around the screen
        mask[:] = 0
        box_w = max(4, min(width - 1, int(size * 0.62)))
        box_h = max(4, min(height - 1, int(size * 0.72)))
        x0, y0 = max(1, (width - box_w) // 2), max(1, (height - box_h) // 2)
        x1, y1 = min(width - 1, x0 + box_w), min(height - 1, y0 + box_h)
        mask[y0, x0:x1 + 1] = 255
        mask[y1, x0:x1 + 1] = 255
        mask[y0:y1 + 1, x0] = 255
        mask[y0:y1 + 1, x1] = 255
    _MASKS[k] = (mask, width)
    return _MASKS[k]


def _text_surface(text, size, color, background, bold=False, italic=False):
    mask, width = _text_mask(text, size, bold, italic)
    surf = Surface((width, mask.shape[0]))
    rgba = _rgba(color)
    if background is not None:
        surf.fill(background)
    surf._solid = None
    _blend_coverage(surf.buf, 0, 0, mask, rgba[:3], rgba[3])
    return surf


class _Font:
    """pygame.font.Font / SysFont: render text to a surface, and measure it."""

    def __init__(self, name=None, size=16, bold=False, italic=False):
        if isinstance(name, (int, float)) and size == 16:
            size, name = name, None
        self.name = name or 'DejaVu Sans'
        self.size_value = max(1, int(size))
        self.bold = bool(bold)
        self.italic = bool(italic)
        self._underline = False

    def render(self, text, antialias=True, color=(255, 255, 255), background=None):
        return _text_surface(str(text), self.size_value, color, background, self.bold, self.italic)

    def size(self, text):
        _, width = _text_mask(str(text), self.size_value, self.bold, self.italic)
        ascent, descent = _font_metrics(self.size_value, self.bold, self.italic)
        return (width, ascent + descent)

    def get_height(self):
        ascent, descent = _font_metrics(self.size_value, self.bold, self.italic)
        return ascent + descent

    def get_ascent(self):
        return _font_metrics(self.size_value, self.bold, self.italic)[0]

    def get_descent(self):
        return _font_metrics(self.size_value, self.bold, self.italic)[1]

    def get_linesize(self):
        return self.get_height()

    def set_bold(self, value=True):
        self.bold = bool(value)
        return None

    def set_italic(self, value=True):
        self.italic = bool(value)
        return None

    def set_underline(self, value=True):
        self._underline = bool(value)
        return None

    def metrics(self, text):
        ascent, descent = _font_metrics(self.size_value, self.bold, self.italic)
        return [(0, 0, 0, 0, 0, 0, 0, 0, 0)] * len(str(text))

    def __repr__(self):
        return '<font.Font(%r, %d)>' % (self.name, self.size_value)


class _FontModule:
    Font = _Font

    def init(self):
        return None

    def quit(self):
        return None

    def get_init(self):
        return True

    def get_default_font(self):
        return 'DejaVu Sans'

    def get_fonts(self):
        return ['DejaVu Sans']

    def match_font(self, name, bold=False, italic=False):
        return 'DejaVu Sans'

    def SysFont(self, name, size, bold=False, italic=False):
        return _Font(name, size, bold, italic)


font = _FontModule()


# ---------------------------------------------------------------------- images
class _ImageModule:
    def load(self, path, namehint=''):
        """There are no picture files to read, so this is a labelled placeholder of the right name."""
        try:
            label = str(path).replace('\\', '/').split('/')[-1][:24]
        except Exception:
            label = 'image'
        surf = Surface((160, 100))
        surf.fill((219, 234, 254))
        draw.rect(surf, (29, 78, 216), Rect(2, 2, 156, 96), 2)
        f = _Font(None, 12)
        text = f.render(label, True, (29, 78, 216))
        surf.blit(text, (8, 38))
        return surf

    def save(self, surface, path, namehint=''):
        try:
            with open(str(path), 'wb') as handle:
                handle.write(_png(np.ascontiguousarray(surface.buf)))
            return True
        except Exception as exc:
            set_error(exc)
            raise

    def load_extended(self, path, *a, **k):
        return self.load(path)

    def get_extended(self):
        return True


image = _ImageModule()


# --------------------------------------------------------------------- drawing
def _bbox_arrays(x0, y0, x1, y1, cx=0.0, cy=0.0):
    xs = np.arange(x0, x1) + 0.5 - cx
    ys = np.arange(y0, y1) + 0.5 - cy
    return np.meshgrid(xs, ys)


def _paint_mask(surface, x0, y0, mask, rgba):
    surface._solid = None
    sh, sw = mask.shape
    if not mask.any() or sw <= 0 or sh <= 0:
        return
    dx0, dy0 = max(0, x0), max(0, y0)
    dx1, dy1 = min(surface.width, x0 + sw), min(surface.height, y0 + sh)
    if dx1 <= dx0 or dy1 <= dy0:
        return
    part = mask[dy0 - y0:dy1 - y0, dx0 - x0:dx1 - x0]
    _blend_coverage(surface.buf, dx0, dy0, part, rgba[:3], rgba[3])


class _DrawModule:
    def rect(self, surface, color, rect_, width=0, border_radius=0, border_top_left_radius=-1,
             border_bottom_right_radius=-1):
        r = Rect(rect_)
        rgba = _rgba(color)
        surface._solid = None
        if width and width > 0:
            w = min(int(width), max(1, min(r.w, r.h) // 2))
            _blend_solid(surface.buf, r.x, r.y, r.w, w, rgba[:3], rgba[3])
            _blend_solid(surface.buf, r.x, r.y + r.h - w, r.w, w, rgba[:3], rgba[3])
            _blend_solid(surface.buf, r.x, r.y + w, w, max(0, r.h - 2 * w), rgba[:3], rgba[3])
            _blend_solid(surface.buf, r.x + r.w - w, r.y + w, w, max(0, r.h - 2 * w), rgba[:3], rgba[3])
        else:
            _blend_solid(surface.buf, r.x, r.y, r.w, r.h, rgba[:3], rgba[3])
        return r

    def circle(self, surface, color, center, radius, width=0, draw_top_right=None):
        cx, cy, radius = float(center[0]), float(center[1]), float(radius)
        x0, x1 = int(math.floor(cx - radius)), int(math.ceil(cx + radius)) + 1
        y0, y1 = int(math.floor(cy - radius)), int(math.ceil(cy + radius)) + 1
        gx, gy = _bbox_arrays(x0, x1, y0, y1, cx, cy)
        d2 = gx * gx + gy * gy
        mask = d2 <= radius * radius
        if width and width > 0:
            inner = max(0.0, radius - float(width))
            mask &= d2 >= inner * inner
        _paint_mask(surface, x0, y0, mask, _rgba(color))
        return Rect(int(cx - radius), int(cy - radius), int(radius * 2), int(radius * 2))

    def ellipse(self, surface, color, rect_, width=0):
        r = Rect(rect_)
        rx, ry = max(0.5, r.w / 2.0), max(0.5, r.h / 2.0)
        cx, cy = r.x + rx, r.y + ry
        gx, gy = _bbox_arrays(r.x, r.x + max(1, r.w), r.y, r.y + max(1, r.h), cx, cy)
        d = (gx / rx) ** 2 + (gy / ry) ** 2
        mask = d <= 1.0
        if width and width > 0:
            sx, sy = max(0.01, rx - width), max(0.01, ry - width)
            mask &= (gx / sx) ** 2 + (gy / sy) ** 2 >= 1.0
        _paint_mask(surface, r.x, r.y, mask, _rgba(color))
        return r

    def line(self, surface, color, start, end, width=1):
        x0, y0 = float(start[0]), float(start[1])
        x1, y1 = float(end[0]), float(end[1])
        half = max(0.5, (int(width) if width else 1) / 2.0)
        left = int(math.floor(min(x0, x1) - half - 1))
        right = int(math.ceil(max(x0, x1) + half + 1))
        top = int(math.floor(min(y0, y1) - half - 1))
        bottom = int(math.ceil(max(y0, y1) + half + 1))
        dx, dy = x1 - x0, y1 - y0
        seg = dx * dx + dy * dy
        gx, gy = _bbox_arrays(left, right, top, bottom)
        if seg == 0:
            dist = np.sqrt((gx - x0) ** 2 + (gy - y0) ** 2)
        else:
            t = ((gx - x0) * dx + (gy - y0) * dy) / seg
            t = np.clip(t, 0.0, 1.0)
            dist = np.sqrt((gx - (x0 + t * dx)) ** 2 + (gy - (y0 + t * dy)) ** 2)
        _paint_mask(surface, left, top, dist <= half, _rgba(color))
        return Rect(int(min(x0, x1)), int(min(y0, y1)), int(abs(x1 - x0)), int(abs(y1 - y0)))

    def lines(self, surface, color, closed, points, width=1):
        pts = [(float(p[0]), float(p[1])) for p in points]
        if not pts:
            return Rect(0, 0, 0, 0)
        order = pts + ([pts[0]] if closed and len(pts) > 2 else [])
        for i in range(len(order) - 1):
            self.line(surface, color, order[i], order[i + 1], width)
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        return Rect(int(min(xs)), int(min(ys)), int(max(xs) - min(xs)), int(max(ys) - min(ys)))

    aalines = lines

    def polygon(self, surface, color, points, width=0):
        pts = [(float(p[0]), float(p[1])) for p in points]
        if len(pts) < 2:
            return Rect(0, 0, 0, 0)
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        left, top = int(math.floor(min(xs))), int(math.floor(min(ys)))
        right, bottom = int(math.ceil(max(xs))) + 1, int(math.ceil(max(ys))) + 1
        if len(pts) >= 3 and (not width or width <= 0):
            try:
                from matplotlib.path import Path as _MPath
                gx, gy = _bbox_arrays(left, right, top, bottom)
                mask = _MPath(pts).contains_points(np.column_stack([gx.ravel(), gy.ravel()])).reshape(gx.shape)
                _paint_mask(surface, left, top, mask, _rgba(color))
            except Exception:
                self.lines(surface, color, True, pts, 1)
        else:
            self.lines(surface, color, True, pts, max(1, int(width or 1)))
        return Rect(left, top, max(0, right - left), max(0, bottom - top))

    def arc(self, surface, color, rect_, start_angle, stop_angle, width=1):
        r = Rect(rect_)
        cx, cy = r.x + r.w / 2.0, r.y + r.h / 2.0
        rx, ry = max(0.5, r.w / 2.0), max(0.5, r.h / 2.0)
        steps = max(12, int(abs(stop_angle - start_angle)))
        pts = []
        for i in range(steps + 1):
            ang = math.radians(start_angle + (stop_angle - start_angle) * i / steps)
            pts.append((cx + rx * math.cos(ang), cy - ry * math.sin(ang)))
        self.lines(surface, color, False, pts, width)
        return r

    def aacircle(self, surface, color, center, radius, width=0):
        return self.circle(surface, color, center, radius, width)

    def aapolygon(self, surface, color, points, width=0):
        return self.polygon(surface, color, points, width)


draw = _DrawModule()


# ------------------------------------------------------------------ transform
class _TransformModule:
    def flip(self, surface, flip_x, flip_y):
        out = Surface((surface.width, surface.height))
        buf = surface.buf
        if flip_x:
            buf = buf[:, ::-1]
        if flip_y:
            buf = buf[::-1]
        out.buf[:] = buf
        return out

    def scale(self, surface, size, dest_surface=None):
        w, h = max(1, int(size[0])), max(1, int(size[1]))
        xs = (np.arange(w) * (surface.width / w)).astype(np.int32).clip(0, max(0, surface.width - 1))
        ys = (np.arange(h) * (surface.height / h)).astype(np.int32).clip(0, max(0, surface.height - 1))
        out = dest_surface or Surface((w, h))
        if surface.width and surface.height:
            out.buf[:h, :w] = surface.buf[np.ix_(ys, xs)]
        return out

    def smoothscale(self, surface, size, dest_surface=None):
        return self.scale(surface, size, dest_surface)

    def scale_by(self, surface, factor, dest_surface=None):
        if isinstance(factor, (tuple, list)):
            sx, sy = float(factor[0]), float(factor[1])
        else:
            sx = sy = float(factor)
        return self.scale(surface, (max(1, int(surface.width * sx)), max(1, int(surface.height * sy))), dest_surface)

    def rotate(self, surface, angle):
        ang = math.radians(float(angle))
        cos_a, sin_a = math.cos(ang), math.sin(ang)
        w, h = surface.width, surface.height
        new_w = max(1, int(abs(w * cos_a) + abs(h * sin_a)))
        new_h = max(1, int(abs(w * sin_a) + abs(h * cos_a)))
        gx, gy = np.meshgrid(np.arange(new_w) - new_w / 2.0 + 0.5, np.arange(new_h) - new_h / 2.0 + 0.5)
        src_x = (gx * cos_a + gy * sin_a + w / 2.0).astype(np.int32)
        src_y = (-gx * sin_a + gy * cos_a + h / 2.0).astype(np.int32)
        inside = (src_x >= 0) & (src_x < w) & (src_y >= 0) & (src_y < h)
        out = Surface((new_w, new_h))
        if w and h:
            out.buf[inside] = surface.buf[src_y[inside].clip(0, h - 1), src_x[inside].clip(0, w - 1)]
        return out

    def rotozoom(self, surface, angle, scale):
        if abs(float(angle)) < 0.01:
            return self.scale_by(surface, scale)
        return self.rotate(self.scale_by(surface, scale), angle)

    def scale2x(self, surface):
        return self.scale(surface, (surface.width * 2, surface.height * 2))

    def chop(self, surface, rect_):
        r = Rect(rect_)
        return surface.subsurface(r)


transform = _TransformModule()


# --------------------------------------------------------------------- sprite
class _SpriteModule:
    class Sprite:
        def __init__(self, *groups):
            self.image = None
            self.rect = None
            self._groups = set()
            for group in groups:
                group.add(self)

        def add(self, *groups):
            for group in groups:
                group.add(self)

        def remove(self, *groups):
            for group in groups:
                group.remove(self)

        def kill(self):
            for group in list(self._groups):
                group.remove(self)

        def alive(self):
            return bool(self._groups)

        def groups(self):
            return list(self._groups)

        def update(self, *a, **k):
            return None

        def __repr__(self):
            return '<%s sprite(in %d groups)>' % (type(self).__name__, len(self._groups))

    class Group:
        def __init__(self, *sprites):
            self.sprites = []
            for s in sprites:
                self.add(s)

        def add(self, *sprites):
            for s in sprites:
                if s not in self.sprites:
                    self.sprites.append(s)
                    s._groups.add(self)

        add_internal = add

        def remove(self, *sprites):
            for s in sprites:
                if s in self.sprites:
                    self.sprites.remove(s)
                    s._groups.discard(self)

        remove_internal = remove

        def has(self, *sprites):
            return all(s in self.sprites for s in sprites)

        def update(self, *a, **k):
            for s in list(self.sprites):
                s.update(*a, **k)

        def draw(self, surface, *a, **k):
            return [surface.blit(s.image, s.rect) for s in list(self.sprites)
                    if getattr(s, 'image', None) is not None and getattr(s, 'rect', None) is not None]

        def clear(self, surface, background):
            self.draw(surface)
            surface.fill(background)

        def empty(self):
            for s in list(self.sprites):
                s._groups.discard(self)
            self.sprites.clear()

        def kill(self):
            self.empty()

        def copy(self):
            return type(self)(*self.sprites)

        def __iter__(self):
            return iter(list(self.sprites))

        def __len__(self):
            return len(self.sprites)

        def __contains__(self, s):
            return s in self.sprites

        def __bool__(self):
            return bool(self.sprites)

    class RenderPlain(Group):
        pass

    RenderClear = RenderUpdates = RenderPlain

    class LayeredUpdates(RenderPlain):
        pass

    class GroupSingle(Group):
        def __init__(self, sprite=None):
            super().__init__()
            self.sprite = None
            if sprite is not None:
                self.add(sprite)

        def add(self, *sprites):
            for s in sprites:
                self.empty()
                self.sprite = s
                self.sprites = [s]
                s._groups.add(self)

        def __iter__(self):
            return iter([self.sprite] if self.sprite else [])

    def spritecollide(sprite, group, dokill, collided=None):
        hits = [s for s in group if s is not sprite and s.rect is not None and sprite.rect is not None
                and sprite.rect.colliderect(s.rect)]
        if dokill:
            for s in hits:
                s.kill()
        return hits

    def groupcollide(groupa, groupb, dokilla, dokillb, collided=None):
        result = {}
        for a in groupa:
            hits = [b for b in groupb if a.rect is not None and b.rect is not None and a.rect.colliderect(b.rect)]
            if hits:
                result[a] = hits
                if dokilla:
                    a.kill()
                if dokillb:
                    for b in hits:
                        b.kill()
        return result

    def spritecollideany(sprite, group, collided=None):
        for s in group:
            if s is not sprite and s.rect is not None and sprite.rect is not None and sprite.rect.colliderect(s.rect):
                return s
        return None


sprite = _SpriteModule()


# ----------------------------------------------------------------------- math
class _Vector:
    __slots__ = ('_v',)

    def __init__(self, *args):
        values = []
        for a in args:
            if isinstance(a, (tuple, list)) or isinstance(a, _Vector):
                values.extend(float(x) for x in a)
            else:
                values.append(float(a))
        if not values:
            values = [0.0] * self._dim()
        self._v = tuple(values[:self._dim()] + [0.0] * max(0, self._dim() - len(values)))

    def __iter__(self):
        return iter(self._v)

    def __len__(self):
        return self._dim()

    def __getitem__(self, i):
        return self._v[i]

    def __setitem__(self, i, value):
        v = list(self._v)
        v[i] = float(value)
        self._v = tuple(v)

    def __eq__(self, other):
        try:
            return tuple(self) == tuple(float(x) for x in other)
        except TypeError:
            return NotImplemented

    def __hash__(self):
        return hash(self._v)

    def __repr__(self):
        return '<Vector%r(%s)>' % (self._dim(), ', '.join('%.2f' % v for v in self._v))

    def __add__(self, other):
        return type(self)(*[a + b for a, b in zip(self._v, _Vector(other)._v)])

    __radd__ = __add__

    def __sub__(self, other):
        return type(self)(*[a - b for a, b in zip(self._v, _Vector(other)._v)])

    def __rsub__(self, other):
        return type(self)(*[b - a for a, b in zip(self._v, _Vector(other)._v)])

    def __mul__(self, other):
        if isinstance(other, (int, float)):
            return type(self)(*[a * other for a in self._v])
        return type(self)(*[a * b for a, b in zip(self._v, _Vector(other)._v)])

    __rmul__ = __mul__

    def __truediv__(self, other):
        if isinstance(other, (int, float)):
            return type(self)(*[a / other for a in self._v])
        return type(self)(*[a / b for a, b in zip(self._v, _Vector(other)._v)])

    def __neg__(self):
        return type(self)(*[-a for a in self._v])

    def _dim(self):
        return 2

    def length(self):
        return math.sqrt(sum(a * a for a in self._v))

    def length_squared(self):
        return sum(a * a for a in self._v)

    def distance_to(self, other):
        return (self - other).length()

    def distance_squared_to(self, other):
        return (self - other).length_squared()

    def normalize(self):
        n = self.length()
        if n:
            self._v = tuple(a / n for a in self._v)
        return self

    def normalized(self):
        return type(self)(*self._v).normalize()

    def dot(self, other):
        return sum(a * b for a, b in zip(self._v, _Vector(other)._v))

    def lerp(self, other, amount):
        other = _Vector(other)
        return type(self)(*[a + (b - a) * float(amount) for a, b in zip(self._v, other._v)])

    def rotate(self, angle):
        a = math.radians(float(angle))
        x, y = self._v[0], self._v[1]
        self._v = (x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a))
        return self

    def rotate_rad(self, angle):
        return self.rotate(math.degrees(angle))

    def rotate_ip(self, angle):
        return self.rotate(angle)

    rotate_rad_ip = rotate_ip

    def angle_to(self, other):
        other = _Vector(other)
        return math.degrees(math.atan2(other._v[1], other._v[0]) - math.atan2(self._v[1], self._v[0]))

    def as_polar(self):
        return (self.length(), math.degrees(math.atan2(self._v[1], self._v[0])))

    def from_polar(self, polar):
        length, angle = polar
        a = math.radians(float(angle))
        self._v = (length * math.cos(a), length * math.sin(a))
        return self

    def scale_to_length(self, length):
        n = self.length()
        if n:
            self._v = tuple(a * length / n for a in self._v)
        return self

    def clamp_magnitude(self, max_length):
        if self.length() > max_length:
            self.scale_to_length(max_length)
        return self

    def elementwise(self):
        return self

    def update(self, *args):
        self._v = _Vector(*args)._v

    def reflect(self, other):
        n = _Vector(other).normalized()
        self._v = tuple(a - 2 * n._v[i] * self.dot(n) for i, a in enumerate(self._v))
        return self

    reflect_ip = reflect

    def copy(self):
        return type(self)(*self._v)

    x = property(lambda s: s._v[0], lambda s, v: s.__setitem__(0, v))
    y = property(lambda s: s._v[1], lambda s, v: s.__setitem__(1, v))


class Vector2(_Vector):
    def _dim(self):
        return 2


class Vector3(_Vector):
    def _dim(self):
        return 3

    z = property(lambda s: s._v[2], lambda s, v: s.__setitem__(2, v))

    def cross(self, other):
        ox, oy, oz = _Vector(other)._v[0], _Vector(other)._v[1], _Vector(other)._v[2]
        x, y, z = self._v
        return Vector3(y * oz - z * oy, z * ox - x * oz, x * oy - y * ox)


class _MathModule:
    """pygame.math: Vector2 and Vector3, plus the usual maths functions so nothing else breaks."""

    Vector2 = Vector2
    Vector3 = Vector3

    def __getattr__(self, name):
        return getattr(_math, name)


math = _MathModule()


# ---------------------------------------------------------- submodule names
def _export_submodules():
    """`import pygame.sprite`, `import pygame.math` and `from pygame.locals import *` must work."""
    sprite_mod = types.ModuleType('pygame.sprite')
    sprite_mod.__dict__.update({
        'Sprite': _SpriteModule.Sprite, 'Group': _SpriteModule.Group,
        'RenderPlain': _SpriteModule.RenderPlain, 'RenderClear': _SpriteModule.RenderClear,
        'RenderUpdates': _SpriteModule.RenderUpdates, 'LayeredUpdates': _SpriteModule.LayeredUpdates,
        'GroupSingle': _SpriteModule.GroupSingle, 'spritecollide': _SpriteModule.spritecollide,
        'groupcollide': _SpriteModule.groupcollide, 'spritecollideany': _SpriteModule.spritecollideany,
    })
    math_mod = types.ModuleType('pygame.math')
    math_mod.Vector2 = Vector2
    math_mod.Vector3 = Vector3
    for mod in (sprite_mod, math_mod, _locals_mod):
        sys.modules.setdefault(mod.__name__, mod)


_export_submodules()


def get_sdl_version():
    return (2, 28, 5)


def get_sdl_byteorder():
    return 1234


def get_num_video_displays():
    return 1
