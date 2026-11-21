"""A small pygame for the practice sandbox: it draws with matplotlib instead of a screen.

Programs written for pygame run here unchanged for the usual beginner things — a window, filling it, rectangles,
circles, lines, polygons, text and blitting one surface onto another. Every call to display.flip()/update() turns the
current frame into a PNG that the page shows under the output, so graphics are never invisible. There is no real
window, no sound and no input: the event queue answers QUIT after a few hundred frames (or at once with
set_frame_limit) so an endless game loop stops instead of hanging the sandbox.
"""

import base64
import io
import math

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import Circle as _MCircle, Polygon as _MPolygon, Rectangle as _MRect, FancyArrow as _MArrow  # noqa: E402

import sandbox_figures  # noqa: E402

__all__ = ['init', 'quit', 'display', 'draw', 'font', 'image', 'event', 'time', 'key', 'rect', 'Rect', 'Surface',
           'Color', 'mixer', 'set_frame_limit', 'frames']

QUIT, KEYDOWN, KEYUP, MOUSEBUTTONDOWN, MOUSEMOTION = 256, 768, 769, 1025, 1024
K_ESCAPE, K_LEFT, K_RIGHT, K_UP, K_DOWN, K_SPACE, K_RETURN = 27, 1073741904, 1073741903, 1073741906, 1073741905, 32, 13
MAX_FRAMES = 240
_frames = 0
_quit_sent = False
_screen = None
COLORS = {'black': '#000000', 'white': '#ffffff', 'red': '#ff0000', 'green': '#00ff00', 'blue': '#0000ff',
          'yellow': '#ffff00', 'orange': '#ffa500', 'purple': '#800080', 'grey': '#808080', 'gray': '#808080',
          'cyan': '#00ffff', 'magenta': '#ff00ff', 'pink': '#ffc0cb', 'brown': '#a52a2a'}


def init():
    return None


def quit():
    return None


def set_frame_limit(n):
    """How many frames may be drawn before the loop is stopped (default 240)."""
    global MAX_FRAMES
    MAX_FRAMES = max(1, int(n))


def frames():
    return _frames


def _color(c, alpha=255):
    if isinstance(c, (str, bytes)):
        s = c.decode() if isinstance(c, bytes) else c
        s = COLORS.get(s.strip().lower(), s)
        s = s.lstrip('#')
        if len(s) == 3:
            s = ''.join(ch * 2 for ch in s)
        return (int(s[0:2], 16) / 255, int(s[2:4], 16) / 255, int(s[4:6], 16) / 255, 1.0)
    if isinstance(c, (int, float)):
        return (c / 255, c / 255, c / 255, 1.0)
    c = list(c)
    if len(c) == 3:
        c.append(alpha)
    return tuple(min(1.0, max(0.0, float(v) / 255)) for v in c[:4])


class Color(tuple):
    def __new__(cls, *args):
        if len(args) == 1 and isinstance(args[0], (tuple, list)):
            args = tuple(args[0])
        return tuple.__new__(cls, args)

    def __getitem__(self, i):
        try:
            return tuple.__getitem__(self, i)
        except IndexError:
            return 255


class Rect:
    def __init__(self, x=0, y=0, w=0, h=0):
        if isinstance(x, (tuple, list)):
            x, y, w, h = (list(x) + [0, 0])[:4]
        elif isinstance(x, Rect):
            x, y, w, h = x.x, x.y, x.w, x.h
        self.x, self.y, self.w, self.h = int(x), int(y), int(w), int(h)

    def __iter__(self):
        return iter((self.x, self.y, self.w, self.h))

    def __repr__(self):
        return '<rect(%d, %d, %d, %d)>' % (self.x, self.y, self.w, self.h)

    def copy(self):
        return Rect(self.x, self.y, self.w, self.h)

    def colliderect(self, other):
        return not (self.x + self.w <= other.x or other.x + other.w <= self.x or
                    self.y + self.h <= other.y or other.y + other.h <= self.y)

    def collidepoint(self, p):
        return self.x <= p[0] < self.x + self.w and self.y <= p[1] < self.y + self.h

    @property
    def size(self):
        return (self.w, self.h)

    @size.setter
    def size(self, v):
        self.w, self.h = int(v[0]), int(v[1])

    def _get(prop):
        def getter(self):
            return {'left': self.x, 'right': self.x + self.w, 'top': self.y, 'bottom': self.y + self.h,
                    'centerx': self.x + self.w // 2, 'centery': self.y + self.h // 2,
                    'width': self.w, 'height': self.h}.get(prop, 0)
        return getter

    def _pair(prop, ax, ay, cx, cy):
        def getter(self):
            return (self.x + self.w // 2 - cx, self.y + self.h // 2 - cy)
        def setter(self, v):
            vx, vy = int(v[0]), int(v[1])
            self.x = vx - (self.w // 2 if ax else 0)
            self.y = vy - (self.h // 2 if ay else 0)
        return property(getter, setter)

    topleft = _pair('topleft', 0, 0, 0, 0)
    topright = _pair('topright', 0, 0, 0, 0)
    center = _pair('center', 1, 1, 0, 0)
    midtop = _pair('midtop', 1, 0, 0, 0)

    @property
    def topright_set(self):
        return None


Rect.left = property(lambda s: s.x, lambda s, v: setattr(s, 'x', int(v)))
Rect.top = property(lambda s: s.y, lambda s, v: setattr(s, 'y', int(v)))
Rect.right = property(lambda s: s.x + s.w, lambda s, v: setattr(s, 'x', int(v) - s.w))
Rect.bottom = property(lambda s: s.y + s.h, lambda s, v: setattr(s, 'y', int(v) - s.h))
Rect.center = Rect.center
Rect.centerx = property(lambda s: s.x + s.w // 2, lambda s, v: setattr(s, 'x', int(v) - s.w // 2))
Rect.centery = property(lambda s: s.y + s.h // 2, lambda s, v: setattr(s, 'y', int(v) - s.h // 2))


def rect(*a, **k):
    if k:
        r = Rect(k.get('left', 0), k.get('top', 0), k.get('width', 0), k.get('height', 0))
        if 'center' in k:
            r.center = k['center']
        return r
    return Rect(*a)


class Surface:
    def __init__(self, size=(64, 64), flags=0):
        if isinstance(size, (tuple, list)):
            self.width, self.height = int(size[0]), int(size[1])
        else:
            self.width, self.height = int(size), int(size)
        self.ops = [('fill', (1, 1, 1, 1))]
        self._rect = None

    def get_size(self):
        return (self.width, self.height)

    size = property(get_size)

    def get_width(self):
        return self.width

    def get_height(self):
        return self.height

    def get_rect(self, **kw):
        r = Rect(0, 0, self.width, self.height)
        for key, value in kw.items():
            setattr(r, key, value)
        return r

    def fill(self, color, rect=None):
        self.ops.append(('fill', _color(color)))
        return Rect(0, 0, self.width, self.height) if rect is None else rect

    def blit(self, source, pos, area=None, special_flags=0):
        x, y = (pos[0], pos[1]) if isinstance(pos, (tuple, list)) else (pos.x, pos.y)
        self.ops.append(('blit', source, int(x), int(y)))
        return Rect(int(x), int(y), getattr(source, 'width', 0), getattr(source, 'height', 0))

    def copy(self):
        s = Surface((self.width, self.height))
        s.ops = list(self.ops)
        return s

    def convert(self, *a):
        return self

    def convert_alpha(self, *a):
        return self

    def set_colorkey(self, *a):
        return None

    def set_alpha(self, *a):
        return None

    def set_at(self, *a):
        return None


class _Event:
    def __init__(self, type, **kw):
        self.type = type
        self.dict = kw
        for key, value in kw.items():
            setattr(self, key, value)

    def __repr__(self):
        return '<Event(%d %s)>' % (self.type, self.dict)


class display:
    @staticmethod
    def init():
        return None

    @staticmethod
    def set_caption(title):
        return None

    @staticmethod
    def set_mode(size=(640, 480), flags=0, depth=0, **kw):
        global _screen
        _screen = Surface(size)
        return _screen

    @staticmethod
    def get_surface():
        global _screen
        if _screen is None:
            _screen = Surface((640, 480))
            _screen.fill((0, 0, 0))
        return _screen

    @staticmethod
    def flip():
        _frame('display.flip')

    @staticmethod
    def update(*a):
        _frame('display.update')

    @staticmethod
    def set_icon(icon):
        return None

    @staticmethod
    def get_init():
        return True

    @staticmethod
    def quit():
        return None


def _render(surface, ax, ox=0, oy=0):
    for op in surface.ops:
        kind = op[0]
        if kind == 'fill':
            ax.add_patch(_MRect((ox, oy), surface.width, surface.height, facecolor=op[1], edgecolor='none', zorder=0))
        elif kind == 'rect':
            _, color, x, y, w, h, width = op
            ax.add_patch(_MRect((ox + x, oy + y), max(1, w), max(1, h), facecolor='none' if width else color,
                                edgecolor=color if width else 'none', linewidth=max(1, width), zorder=1))
        elif kind == 'circle':
            _, color, cx, cy, r, width = op
            ax.add_patch(_MCircle((ox + cx, oy + cy), max(0.5, r), facecolor='none' if width else color,
                                  edgecolor=color if width else 'none', linewidth=max(1, width), zorder=1))
        elif kind == 'ellipse':
            _, color, cx, cy, rx, ry, width = op
            from matplotlib.patches import Ellipse as _MEllipse
            ax.add_patch(_MEllipse((ox + cx, oy + cy), max(1, rx * 2), max(1, ry * 2), facecolor='none' if width else color,
                                   edgecolor=color if width else 'none', linewidth=max(1, width), zorder=1))
        elif kind == 'line':
            _, color, pts, width = op
            ax.plot([ox + p[0] for p in pts], [oy + p[1] for p in pts], color=color, linewidth=max(1, width),
                    solid_capstyle='round', zorder=2)
        elif kind == 'poly':
            _, color, pts, width = op
            ax.add_patch(_MPolygon([(ox + p[0], oy + p[1]) for p in pts], closed=width == 0,
                                   facecolor='none' if width else color, edgecolor=color, linewidth=max(1, width), zorder=2))
        elif kind == 'text':
            _, text, x, y, color, size = op
            ax.text(ox + x, oy + y, text, color=color, fontsize=max(4, size), family='DejaVu Sans', zorder=3,
                    va='top', ha='left')
        elif kind == 'blit':
            _, source, x, y = op
            _render(source, ax, ox + x, oy + y)


def _frame(title):
    global _frames, _quit_sent
    _frames += 1
    surface = display.get_surface()
    fig = plt.figure(figsize=(surface.width / 100.0, surface.height / 100.0), dpi=100)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, surface.width)
    ax.set_ylim(surface.height, 0)
    ax.axis('off')
    _render(surface, ax)
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=100)
    plt.close(fig)
    sandbox_figures.add(base64.b64encode(buf.getvalue()).decode(), title)
    if _frames >= MAX_FRAMES:
        if not _quit_sent:
            _quit_sent = True
        else:
            raise RuntimeError('pygame stopped after %d frames so the sandbox stays responsive. '
                               'Draw fewer frames, or call pygame.set_frame_limit(n) first.' % MAX_FRAMES)


class draw:
    @staticmethod
    def rect(surface, color, r, width=0, border_radius=0):
        x, y, w, h = (r.x, r.y, r.w, r.h) if isinstance(r, Rect) else (r[0], r[1], r[2], r[3])
        surface.ops.append(('rect', _color(color), int(x), int(y), int(w), int(h), int(width)))
        return Rect(x, y, w, h)

    @staticmethod
    def circle(surface, color, center, radius, width=0):
        surface.ops.append(('circle', _color(color), int(center[0]), int(center[1]), int(radius), int(width)))
        return Rect(int(center[0]) - radius, int(center[1]) - radius, radius * 2, radius * 2)

    @staticmethod
    def ellipse(surface, color, r, width=0):
        x, y, w, h = (r.x, r.y, r.w, r.h) if isinstance(r, Rect) else (r[0], r[1], r[2], r[3])
        surface.ops.append(('ellipse', _color(color), int(x + w / 2), int(y + h / 2), int(w / 2), int(h / 2), int(width)))
        return Rect(x, y, w, h)

    @staticmethod
    def line(surface, color, start, end, width=1):
        surface.ops.append(('line', _color(color), [(int(start[0]), int(start[1])), (int(end[0]), int(end[1]))], int(width)))
        return Rect(min(start[0], end[0]), min(start[1], end[1]), abs(end[0] - start[0]), abs(end[1] - start[1]))

    @staticmethod
    def lines(surface, color, closed, points, width=1):
        pts = [(int(p[0]), int(p[1])) for p in points]
        surface.ops.append(('poly', _color(color), pts, 0 if closed else int(width)))
        return Rect(min(p[0] for p in pts), min(p[1] for p in pts), 1, 1)

    @staticmethod
    def polygon(surface, color, points, width=0):
        pts = [(int(p[0]), int(p[1])) for p in points]
        surface.ops.append(('poly', _color(color), pts, int(width)))
        return Rect(min(p[0] for p in pts), min(p[1] for p in pts), 1, 1)

    aalines = lines

    @staticmethod
    def arc(surface, color, r, start_angle, stop_angle, width=1):
        x, y, w, h = (r.x, r.y, r.w, r.h) if isinstance(r, Rect) else (r[0], r[1], r[2], r[3])
        cx, cy, rx, ry = x + w / 2, y + h / 2, w / 2, h / 2
        steps = max(8, int(abs(stop_angle - start_angle)))
        pts = [(cx + rx * math.cos(math.radians(start_angle + (stop_angle - start_angle) * i / steps)),
                cy - ry * math.sin(math.radians(start_angle + (stop_angle - start_angle) * i / steps))) for i in range(steps + 1)]
        surface.ops.append(('line', _color(color), [(int(a), int(b)) for a, b in pts], int(width)))


class _TextSurface(Surface):
    def __init__(self, text, size, color):
        width = max(1, int(len(str(text)) * size * 0.62))
        super().__init__((width, int(size * 1.35)))
        self.ops = [('text', str(text), 0, 0, _color(color), size)]


class font:
    @staticmethod
    def init():
        return None

    @staticmethod
    def get_init():
        return True

    @staticmethod
    def get_default_font():
        return 'DejaVu Sans'

    class Font:
        def __init__(self, name=None, size=16, bold=False, italic=False):
            self.size_value = int(size)

        def render(self, text, antialias=True, color=(255, 255, 255), background=None):
            return _TextSurface(text, self.size_value, color)

        def size(self, text):
            return (max(1, int(len(str(text)) * self.size_value * 0.62)), int(self.size_value * 1.35))

        def get_height(self):
            return int(self.size_value * 1.35)

        def set_bold(self, value=True):
            return None

        def set_italic(self, value=True):
            return None

    @staticmethod
    def SysFont(name, size, bold=False, italic=False):
        return font.Font(name, size, bold, italic)


class image:
    @staticmethod
    def load(path, *a):
        try:
            name = str(path).split('/')[-1].split('\\')[-1]
        except Exception:
            name = 'image'
        s = Surface((160, 100))
        s.ops = [('fill', _color('#dbeafe')), ('rect', _color('#1d4ed8'), 2, 2, 156, 96, 2),
                 ('text', name[:18], 8, 36, _color('#1d4ed8'), 11)]
        return s

    @staticmethod
    def save(surface, path, *a):
        return None


class event:
    @staticmethod
    def get(*types):
        if _quit_sent:
            return [_Event(QUIT)]
        return []

    @staticmethod
    def get_types(*a):
        return [QUIT]

    @staticmethod
    def pump():
        return None

    @staticmethod
    def poll():
        return _Event(QUIT) if _quit_sent else _Event(0)

    @staticmethod
    def set_grab(value):
        return None

    @staticmethod
    def set_allowed(*a):
        return None


class _Clock:
    def __init__(self):
        self.last = 0

    def tick(self, fps=60):
        self.last = int(1000 / max(1, fps))
        return self.last

    def tick_busy_loop(self, fps=60):
        return self.tick(fps)

    def get_fps(self):
        return 60.0

    def get_time(self):
        return self.last


class time:
    Clock = _Clock

    @staticmethod
    def delay(ms):
        return int(ms)

    wait = delay

    @staticmethod
    def get_ticks():
        return _frames * 16


class key:
    K_ESCAPE, K_LEFT, K_RIGHT, K_UP, K_DOWN, K_SPACE, K_RETURN, K_a = K_ESCAPE, K_LEFT, K_RIGHT, K_UP, K_DOWN, K_SPACE, K_RETURN, 97

    @staticmethod
    def get_pressed():
        return _Keys()

    @staticmethod
    def get_mods():
        return 0


class _Keys:
    def __getitem__(self, k):
        return False


class mixer:
    @staticmethod
    def init(*a):
        return None

    @staticmethod
    def quit():
        return None

    @staticmethod
    def Sound(*a):
        class _S:
            def play(self, *x):
                return None
            def stop(self):
                return None
            def set_volume(self, v):
                return None
        return _S()

    music = Sound
