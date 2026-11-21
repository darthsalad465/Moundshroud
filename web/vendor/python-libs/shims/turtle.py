"""A small turtle for the practice sandbox: it draws with matplotlib instead of a window.

forward, backward, left, right, goto, penup/pendown, colour, pensize, circle, dot, write, begin_fill/end_fill and
done/mainloop all work. The drawing is turned into a PNG when done() is called (or when the program ends), so a turtle
program always shows the picture it drew instead of printing nothing.
"""

import base64
import io
import math

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import Circle as _MCircle, Polygon as _MPolygon  # noqa: E402

import sandbox_figures  # noqa: E402

_screens = []


class _Turtle:
    def __init__(self):
        self.x, self.y = 0.0, 0.0
        self.heading = 0.0
        self._down = True
        self._color = '#1d4ed8'
        self._fill = None
        self._width = 1.5
        self.strokes = []
        self.fills = []
        self.dots = []
        self.texts = []
        self.shown = True
        self._fill_pts = None
        self._pending = None
        self._last_sig = None

    # ---- motion ----
    def _move_to(self, nx, ny):
        if self._down and self._color is not None:
            if self._pending is None:
                self._pending = [(self.x, self.y)]
            self._pending.append((nx, ny))
        self.x, self.y = nx, ny

    def _flush_pending(self):
        if self._pending and len(self._pending) > 1:
            self.strokes.append((list(self._pending), self._color, self._width))
        self._pending = None

    def forward(self, d):
        r = math.radians(self.heading)
        self._flush_pending()
        self._move_to(self.x + d * math.cos(r), self.y + d * math.sin(r))

    fd = forward

    def backward(self, d):
        self.forward(-d)

    bk = backward
    back = backward

    def right(self, a):
        self.heading -= a
        self._flush_pending()

    rt = right

    def left(self, a):
        self.heading += a
        self._flush_pending()

    lt = left

    def goto(self, x, y=None):
        if y is None:
            x, y = x
        self._flush_pending()
        self._move_to(float(x), float(y))

    setpos = goto
    setposition = goto

    def setheading(self, a):
        self.heading = float(a)
        self._flush_pending()

    seth = setheading

    def home(self):
        self.goto(0, 0)
        self.setheading(0)

    def penup(self):
        self._flush_pending()
        self._down = False

    pu = penup
    up = penup

    def pendown(self):
        self._down = True

    pd = pendown
    down = pendown

    def isdown(self):
        return self._down

    def pensize(self, w=None):
        if w is None:
            return self._width
        self._flush_pending()
        self._width = float(w)

    width = pensize

    def pencolor(self, *a):
        self._flush_pending()
        self._color = _col(a)
        return self._color

    color = pencolor

    def fillcolor(self, *a):
        self._fill = _col(a)

    def begin_fill(self):
        self._fill_pts = [(self.x, self.y)]

    def end_fill(self):
        if self._fill_pts and len(self._fill_pts) > 2:
            self.fills.append((self._fill_pts, self._fill or self._color))
        self._fill_pts = None

    def circle(self, radius, extent=360, steps=0):
        # walk the arc around a centre that sits one radius to the left of the heading, like the real turtle
        cx = self.x + radius * math.cos(math.radians(self.heading + 90))
        cy = self.y + radius * math.sin(math.radians(self.heading + 90))
        n = steps or max(8, int(abs(extent) / 10))
        pts = [(self.x, self.y)]
        for i in range(1, n + 1):
            ang = math.radians(self.heading + 90 - extent * i / n)
            pts.append((cx + radius * math.cos(ang), cy + radius * math.sin(ang)))
        self._flush_pending()
        if self._down:
            self.strokes.append((pts, self._color, self._width))
        self.x, self.y = pts[-1]
        self.heading -= extent

    def dot(self, size=4, *a):
        self.dots.append((self.x, self.y, max(1, size / 2), _col(a) if a else self._color))

    def write(self, text, *a, **k):
        self.texts.append((str(text), self.x, self.y, self._color))

    def speed(self, *a):
        return None

    def hideturtle(self):
        self.shown = False

    ht = hideturtle

    def showturtle(self):
        self.shown = True

    st = showturtle

    def shape(self, *a):
        return None

    def stamp(self, *a):
        return None

    def clear(self):
        self.strokes, self.fills, self.dots, self.texts = [], [], [], []
        self._pending = None
        self._last_sig = None

    def reset(self):
        self.clear()
        self.x = self.y = self.heading = 0
        self._down = True


def _col(args):
    if not args:
        return '#1d4ed8'
    if len(args) == 1:
        v = args[0]
        if isinstance(v, (tuple, list)):
            if len(v) == 1:
                g = v[0] / 255
                return (g, g, g)
            return tuple(min(1.0, max(0.0, c / 255)) for c in v[:3])
        if isinstance(v, str):
            return v
        g = v / 255
        return (g, g, g)
    if len(args) == 2:              # (r, g) in turtle means hue/value: keep it simple
        g = args[1] / 255
        return (g, g, g)
    return tuple(min(1.0, max(0.0, c / 255)) for c in args[:3])


_default = _Turtle()


def _screen():
    return _Turtle() if not _screens else _screens[0]


def _sig(t):
    """What has been drawn so far, so the same drawing is not saved twice."""
    return (len(t.strokes), len(t.fills), len(t.dots), len(t.texts), len(t.strokes[-1][0]) if t.strokes else 0)


def _render(t, title='turtle'):
    pts = [p for stroke in t.strokes for p in stroke[0]]
    if not pts and not t.dots and not t.texts:
        return False
    sig = _sig(t)
    if sig == t._last_sig:
        return False
    t._last_sig = sig
    xs = [p[0] for p in pts] + [d[0] for d in t.dots] or [0]
    ys = [p[1] for p in pts] + [d[1] for d in t.dots] or [0]
    lo_x, hi_x = min(xs) - 40, max(xs) + 40
    lo_y, hi_y = min(ys) - 40, max(ys) + 40
    span = max(hi_x - lo_x, hi_y - lo_y, 200)
    fig = plt.figure(figsize=(5, 5), dpi=100)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(lo_x, lo_x + span)
    ax.set_ylim(lo_y, lo_y + span)
    ax.axis('off')
    for points, color, width in t.strokes:
        ax.plot([p[0] for p in points], [p[1] for p in points], color=color, linewidth=max(1, width), solid_capstyle='round')
    for points, color in t.fills:
        ax.add_patch(_MPolygon(points, closed=True, facecolor=color, edgecolor='none', alpha=0.85))
    for x, y, r, color in t.dots:
        ax.add_patch(_MCircle((x, y), r, facecolor=color, edgecolor='none'))
    for text, x, y, color in t.texts:
        ax.text(x, y, text, color=color, fontsize=11)
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=100)
    plt.close(fig)
    sandbox_figures.add(base64.b64encode(buf.getvalue()).decode(), title)
    return True


def _flush():
    """Turn whatever has been drawn into a picture (called by done() and at the end of the run)."""
    done = False
    for t in [_default] + _screens:
        if _render(t):
            done = True
    return done


def done():
    _flush()


mainloop = done
exitonclick = done
bye = done


def clearscreen():
    _default.clear()


def setup(*a, **k):
    return None


def screensize(*a, **k):
    return None


def bgcolor(*a):
    return None


def title(*a):
    return None


def tracer(*a, **k):
    return None


def update():
    return None


def _delegate(name):
    def fn(*a, **k):
        return getattr(_default, name)(*a, **k)
    fn.__name__ = name
    return fn


for _name in ['forward', 'fd', 'backward', 'bk', 'back', 'right', 'rt', 'left', 'lt', 'goto', 'setpos',
              'setposition', 'setheading', 'seth', 'home', 'penup', 'pu', 'up', 'pendown', 'pd', 'down', 'isdown',
              'pensize', 'width', 'pencolor', 'color', 'fillcolor', 'begin_fill', 'end_fill', 'circle', 'dot',
              'write', 'speed', 'hideturtle', 'ht', 'showturtle', 'st', 'shape', 'stamp', 'clear', 'reset']:
    globals()[_name] = _delegate(_name)
