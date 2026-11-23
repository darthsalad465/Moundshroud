"""A headless tkinter for the sandbox: the widgets are drawn with Pillow, and every frame becomes a picture.

There is no window and no window manager, but code written for Tk runs: Tk with a title, a geometry and `after`,
Frames, Labels, Buttons, Entries, Text, Listbox, Checkbutton, Radiobutton, Scale, Scrollbar, Canvas (lines,
rectangles, ovals, polygons, arcs, text and images), PhotoImage/ImageTk.PhotoImage, StringVar and friends, the common
`grid`/`pack`/`place` geometry managers, and `update()`/`mainloop()`.

Drawing is kept: the last few frames of the run are shown under the output, so a program that only draws a window is
never invisible. A `mainloop` that keeps scheduling itself is stopped by the frame limit (90 frames by default, or
whatever `tkinter.set_frame_limit(n)` says) and by a short time budget, so the sandbox stays quick.

What is not there: nothing can be clicked, typed or dragged (bindings are remembered but never fired), and the
message and file dialogs answer as if they were cancelled. `print` still works.
"""

import base64
import io
import math
import re
import sys
import time
import traceback
import types
from collections import deque

import sandbox_figures

try:
    from PIL import Image, ImageDraw, ImageFont
except Exception:                       # Pillow is loaded on demand by the runner
    Image = ImageDraw = ImageFont = None

# ------------------------------------------------------------------ constants
N, S, E, W, NW, NE, SW, SE, CENTER = 'n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se', 'center'
NSEW, NS, EW = 'nsew', 'ns', 'ew'
LEFT, RIGHT, TOP, BOTTOM = 'left', 'right', 'top', 'bottom'
X, Y, BOTH = 'x', 'y', 'both'
HORIZONTAL, VERTICAL = 'horizontal', 'vertical'
END, INSERT, ANCHOR, SEL, SEL_FIRST, SEL_LAST, CURRENT = 'end', 'insert', 'anchor', 'sel', 'sel.first', 'sel.last', 'current'
NORMAL, DISABLED, ACTIVE, HIDDEN = 'normal', 'disabled', 'active', 'hidden'
FLAT, RAISED, SUNKEN, GROOVE, RIDGE, SOLID = 'flat', 'raised', 'sunken', 'groove', 'ridge', 'solid'
YES, NO, TRUE, FALSE, ON, OFF = 1, 0, 1, 0, 1, 0
WORD, CHAR, NONE = 'word', 'char', 'none'
TkVersion, TclVersion = 8.6, 8.6

# ---------------------------------------------------------------- frame capture
DEFAULT_FRAMES = 90
MAX_FRAMES = DEFAULT_FRAMES
MAX_SECONDS = 12.0
FRAMES = deque(maxlen=8)
_windows = []
_count = [0]
_focus = [None]


def set_frame_limit(n):
    """How many frames `mainloop`/`update` may draw before the program is stopped (default 90)."""
    global MAX_FRAMES
    MAX_FRAMES = max(1, int(n))


def frames():
    """How many frames have been drawn so far."""
    return _count[0]


def _flush():
    """Turn the frames kept during the run into pictures the page can show. Called when the program ends.

    It also clears what the run left behind, so the next program in the same session starts with no windows, no
    frames counted and the default frame limit.
    """
    global MAX_FRAMES
    out = 0
    kept = list(FRAMES)
    FRAMES.clear()
    for number, img in kept:
        try:
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            sandbox_figures.add(base64.b64encode(buf.getvalue()).decode(), 'frame %d' % number)
            out += 1
        except Exception:
            break
    _count[0] = 0
    _windows.clear()
    _default[0] = None
    _focus[0] = None
    _warned_pillow[0] = False
    MAX_FRAMES = DEFAULT_FRAMES
    return out


def _load_pillow():
    """Pillow is loaded on demand by the runner, so pick it up if it only arrived after this module was imported."""
    global Image, ImageDraw, ImageFont
    if Image is not None:
        return True
    for attempt in range(2):
        try:
            from PIL import Image as image, ImageDraw as image_draw, ImageFont as image_font
        except Exception:
            # Pillow that was caught half-installed is dropped, so the next attempt can import it cleanly
            sys.modules.pop('PIL', None)
            continue
        Image, ImageDraw, ImageFont = image, image_draw, image_font
        try:
            _install_show()                  # now that Pillow is here, Image.show() can keep the picture
        except Exception:
            pass
        return True
    return False


_warned_pillow = [False]


def _can_draw():
    """True when the window can be drawn; when Pillow is missing, say so once and let the program end."""
    if _load_pillow():
        return True
    if not _warned_pillow[0]:
        _warned_pillow[0] = True
        print('tkinter cannot draw here: the sandbox needs Pillow to show a window, and Pillow could not be loaded. '
              'Run the program again (each run retries the download); if it keeps happening, reload the page.')
    return False


class TclError(Exception):
    """tkinter.TclError, so `except tkinter.TclError:` works."""


# -------------------------------------------------------------------- colours
_NAMED = {
    'black': (0, 0, 0), 'white': (255, 255, 255), 'red': (255, 0, 0), 'green': (0, 128, 0),
    'lime': (0, 255, 0), 'blue': (0, 0, 255), 'yellow': (255, 255, 0), 'orange': (255, 165, 0),
    'purple': (128, 0, 128), 'grey': (128, 128, 128), 'gray': (128, 128, 128), 'cyan': (0, 255, 255),
    'aqua': (0, 255, 255), 'magenta': (255, 0, 255), 'pink': (255, 192, 203), 'brown': (165, 42, 42),
    'navy': (0, 0, 128), 'teal': (0, 128, 128), 'olive': (128, 128, 0), 'silver': (192, 192, 192),
    'maroon': (128, 0, 0), 'gold': (255, 215, 0), 'coral': (255, 127, 80), 'salmon': (250, 128, 114),
    'violet': (238, 130, 238), 'indigo': (75, 0, 130), 'ivory': (255, 255, 240), 'khaki': (240, 230, 140),
    'lavender': (230, 230, 250), 'skyblue': (135, 206, 235), 'darkgreen': (0, 100, 0),
    'darkblue': (0, 0, 139), 'darkred': (139, 0, 0), 'lightblue': (173, 216, 230),
    'lightgreen': (144, 238, 144), 'lightgrey': (211, 211, 211), 'lightgray': (211, 211, 211),
    'darkgrey': (169, 169, 169), 'darkgray': (169, 169, 169), 'tomato': (255, 99, 71),
    'steelblue': (70, 130, 180), 'forestgreen': (34, 139, 34), 'crimson': (220, 20, 60),
    'navajowhite': (255, 222, 173), 'beige': (245, 245, 220), 'aliceblue': (240, 248, 255),
}
_GREY = (217, 217, 217)


def _rgb(color, default=None):
    """Any Tk colour (name, '#rrggbb', '#rgb', tuple, int) -> an (r, g, b) tuple."""
    if color is None or color == '':
        color = default if default is not None else _GREY
    if isinstance(color, (tuple, list)):
        seq = [int(max(0, min(255, float(c)))) for c in list(color)[:3]]
        while len(seq) < 3:
            seq.append(0)
        return tuple(seq)
    if isinstance(color, (int, float)):
        v = int(max(0, min(255, color)))
        return (v, v, v)
    text = str(color).strip().lower()
    if text in _NAMED:
        return _NAMED[text]
    if text.startswith('#'):
        body = text[1:]
        if len(body) == 3:
            body = ''.join(ch * 2 for ch in body)
        if len(body) >= 6:
            try:
                return tuple(int(body[i:i + 2], 16) for i in (0, 2, 4))
            except ValueError:
                return _GREY
    return _GREY


def _shade(rgb, factor):
    return tuple(int(max(0, min(255, c * factor))) for c in rgb)


# ---------------------------------------------------------------------- fonts
_FONTS = {}
_SIZES = {}


def _font_px(value, default=12):
    """The pixel size in a Tk font (12, 'Helvetica 16 bold', ('Times', 20, 'bold'))."""
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return max(6, int(value))
    if isinstance(value, (tuple, list)):
        for item in list(value)[1:]:
            if isinstance(item, (int, float)):
                return max(6, int(item))
            if isinstance(item, str) and item.strip().lstrip('-').isdigit():
                return max(6, int(item.strip()))
        return default
    text = str(value)
    match = re.search(r'(-?\d+)', text)
    if match:
        return max(6, int(match.group(1)))
    if 'small' in text:
        return 10
    if 'large' in text:
        return 18
    return default


def _font(value):
    if ImageFont is None:
        return None
    px = _font_px(value)
    found = _FONTS.get(px)
    if found is None:
        try:
            found = ImageFont.load_default(size=px)
        except TypeError:                  # Pillow < 10.1
            found = ImageFont.load_default()
        _FONTS[px] = found
    return found


_DRAWER = [None]


def _drawer_class():
    """The ImageDraw subclass, made when a window is drawn, not when this module is imported: the runner may add
    Pillow after tkinter is already loaded, and a class built from a missing Pillow can never draw."""
    base = ImageDraw.ImageDraw if ImageDraw is not None else None
    if base is None:
        return None
    made = _DRAWER[0]
    if made is None or not issubclass(made, base):
        made = type('_Drawer', (base,), {'__doc__': 'An ImageDraw that remembers the picture it draws on, so an item can paste an image onto it.'})
        _DRAWER[0] = made
    return made


def _new_draw(image):
    cls = _drawer_class()
    if cls is None:
        return None
    draw = cls(image)
    draw._image = image
    return draw


_SCRATCH = None


def _scratch_draw():
    global _SCRATCH
    if _SCRATCH is None and Image is not None:
        _SCRATCH = ImageDraw.Draw(Image.new('RGB', (8, 8)))
    return _SCRATCH


def _text_size(text, font):
    text = '' if text is None else str(text)
    key = (text, id(font))
    size = _SIZES.get(key)
    if size is not None:
        return size
    draw = _scratch_draw()
    if draw is None or font is None:
        return (max(1, len(text)) * 7, 14)
    try:
        box = draw.textbbox((0, 0), text or ' ', font=font)
        size = (max(1, box[2] - box[0]), max(1, box[3] - box[1]))
    except Exception:
        size = (max(1, len(text)) * 7, 14)
    if len(_SIZES) > 400:
        _SIZES.clear()
    _SIZES[key] = size
    return size


_ANCHOR = {
    NW: (0.0, 0.0), N: (0.5, 0.0), NE: (1.0, 0.0), W: (0.0, 0.5), CENTER: (0.5, 0.5),
    E: (1.0, 0.5), SW: (0.0, 1.0), S: (0.5, 1.0), SE: (1.0, 1.0),
}


def _anchor_parts(anchor):
    return _ANCHOR.get(str(anchor or CENTER).lower(), (0.5, 0.5))


def _draw_text(draw, x, y, text, font, fill, anchor=CENTER):
    text = '' if text is None else str(text)
    if not text:
        return
    w, h = _text_size(text, font)
    ax, ay = _anchor_parts(anchor)
    try:
        draw.text((x - w * ax, y - h * ay), text, font=font, fill=fill)
    except Exception:
        try:
            draw.text((x, y), text, fill=fill)
        except Exception:
            pass


def _wrap(text, font, width):
    """Split text into lines that fit width (for wraplength, Text and Label)."""
    lines = []
    for para in str(text).split('\n'):
        if not width or width <= 0:
            lines.append(para)
            continue
        words = para.split(' ')
        line = ''
        for word in words:
            trial = (line + ' ' + word).strip()
            if line and _text_size(trial, font)[0] > width:
                lines.append(line)
                line = word
            else:
                line = trial
        lines.append(line)
    return lines


def _num(value, default=0):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _truth(value):
    return str(value).lower() in ('1', 'true', 'yes', 'on')


# ------------------------------------------------------------------- variables
class Variable:
    """StringVar/IntVar/DoubleVar/BooleanVar: the value lives here, widgets read it when they are drawn."""

    _default = ''

    def __init__(self, master=None, value=None, name=None):
        self._value = self._default if value is None else value
        self._traces = {}
        self._name = name or 'PY_VAR'

    def get(self):
        return self._value

    def set(self, value):
        self._value = value
        for callback in list(self._traces.values()):
            try:
                callback(self._name, '', 'write')
            except TypeError:
                try:
                    callback('', '', 'write')
                except Exception:
                    pass
            except Exception:
                pass

    def trace_add(self, mode, callback):
        key = 'trace%d' % len(self._traces)
        self._traces[key] = callback
        return key

    def trace(self, mode, callback):
        return self.trace_add(mode, callback)

    def trace_remove(self, mode, key):
        self._traces.pop(key, None)

    def trace_vdelete(self, mode, key):
        self._traces.pop(key, None)

    def __repr__(self):
        return '<%s %s=%r>' % (type(self).__name__, self._name, self._value)


class StringVar(Variable):
    _default = ''

    def get(self):
        return '' if self._value is None else str(self._value)


class IntVar(Variable):
    _default = 0

    def get(self):
        try:
            return int(float(self._value))
        except (TypeError, ValueError):
            return 0


class DoubleVar(Variable):
    _default = 0.0

    def get(self):
        try:
            return float(self._value)
        except (TypeError, ValueError):
            return 0.0


class BooleanVar(Variable):
    _default = 0

    def get(self):
        return 1 if _truth(self._value) else 0


# --------------------------------------------------------------------- images
class PhotoImage:
    """A picture for a Label or a Canvas. `PhotoImage(file=...)`, `PhotoImage(data=...)` and ImageTk.PhotoImage(image)."""

    def __init__(self, image=None, size=None, master=None, **kw):
        pil = None
        if isinstance(image, Image.Image if Image is not None else ()):
            pil = image
        elif isinstance(image, Misc):
            master = image
        elif image is not None and not isinstance(image, str):
            try:
                pil = Image.fromarray(image)
            except Exception:
                pil = None
        if pil is None and size is not None and Image is not None:
            try:
                pil = Image.new('RGB', (max(1, _num(size[0], 1)), max(1, _num(size[1], 1))), kw.get('background', 'white'))
            except Exception:
                pil = None
        if pil is None and kw.get('file') is not None and Image is not None:
            try:
                pil = Image.open(kw['file'])
            except Exception:
                pil = None
        if pil is None and kw.get('data') is not None and Image is not None:
            try:
                raw = kw['data']
                if isinstance(raw, str):
                    raw = raw.encode()
                pil = Image.open(io.BytesIO(base64.b64decode(raw)))
            except Exception:
                pil = None
        if pil is None:
            w = _num(kw.get('width'), 1) or 1
            h = _num(kw.get('height'), 1) or 1
            pil = Image.new('RGB', (max(1, w), max(1, h)), 'white') if Image is not None else None
        self._pil = pil.convert('RGB') if pil is not None else None
        self._zoom = 1
        self._subsample = 1

    @property
    def image(self):
        return self._pil

    def _render(self):
        if self._pil is None:
            return None
        img = self._pil
        if self._subsample > 1:
            img = img.resize((max(1, img.width // self._subsample), max(1, img.height // self._subsample)), Image.NEAREST)
        if self._zoom > 1:
            img = img.resize((img.width * self._zoom, img.height * self._zoom), Image.NEAREST)
        return img

    def width(self):
        img = self._render()
        return img.width if img is not None else 0

    def height(self):
        img = self._render()
        return img.height if img is not None else 0

    def get(self, x, y):
        try:
            return self._pil.getpixel((int(x), int(y)))
        except Exception:
            return (0, 0, 0)

    def put(self, data, to=None):
        """Paint pixels. `data` is one row ('#fff #000 ...') or a ' {#fff ...} {...}' block."""
        if self._pil is None:
            return
        rows = re.findall(r'\{([^}]*)\}', str(data))
        if not rows:
            at = (0, 0) if to is None else (to[0] if isinstance(to, (tuple, list)) else 0, to[1] if isinstance(to, (tuple, list)) and len(to) > 1 else 0)
            rows = [[str(data)]]
            origin = at
        else:
            origin = (0, 0) if to is None else tuple(to)
        for row_index, row in enumerate(rows):
            cells = re.findall(r'#[0-9a-fA-F]{3,6}|[A-Za-z]+', ' ' + row)
            for col_index, cell in enumerate(cells):
                try:
                    self._pil.putpixel((origin[0] + col_index, origin[1] + row_index), _rgb(cell, 'black'))
                except Exception:
                    return

    def copy(self):
        return PhotoImage(self._render())

    def zoom(self, x=2, y=None):
        self._zoom *= max(1, _num(x, 1))
        return self

    def subsample(self, x=2, y=None):
        self._subsample *= max(1, _num(x, 1))
        return self

    def write(self, filename, format=None):
        if self._pil is not None:
            self._pil.save(filename, format=format)

    def transparency_get(self, x, y):
        return 0

    def transparency_set(self, x, y, boolean):
        return None


class BitmapImage(PhotoImage):
    def __init__(self, *a, **k):
        PhotoImage.__init__(self, **k)


class ImageTk:
    """What `from PIL import ImageTk` gets: `PhotoImage(pil_image)`, drawn by the Canvas."""


def _install_imagetk():
    """Make `from PIL import ImageTk import PhotoImage` work even though Pillow's own needs a real Tcl."""
    module = types.ModuleType('PIL.ImageTk')
    module.PhotoImage = PhotoImage
    module.BitmapImage = BitmapImage
    module.__doc__ = 'Pillow images for this sandbox\'s headless tkinter.'
    sys.modules['PIL.ImageTk'] = module
    try:
        import PIL
        PIL.ImageTk = module
    except Exception:
        pass
    return module


def _install_show():
    """PIL Image.show() has no viewer here, so it adds the picture to the run instead."""
    if Image is None:
        return
    original = getattr(Image.Image, 'show', None)
    if getattr(original, '_sandbox', False):
        return

    def show(self, title=None, **kw):
        try:
            buf = io.BytesIO()
            self.convert('RGB').save(buf, format='PNG')
            sandbox_figures.add(base64.b64encode(buf.getvalue()).decode(), title or 'image')
        except Exception:
            pass

    show._sandbox = True
    Image.Image.show = show


# -------------------------------------------------------------------- canvases
class Misc:
    """Everything a widget can do that does not depend on what it looks like."""

    def __init__(self, master=None, **kw):
        if master is None:
            master = _default_root()
        if master is None:
            master = Tk()
        self.master = master
        self.tk = master if isinstance(master, Tk) else getattr(master, 'tk', None)
        self.toplevel = master if isinstance(master, (Tk, Toplevel)) else getattr(master, 'toplevel', None)
        self._children = []
        self._binds = {}
        self._pack = None
        self._grid = None
        self._place = None
        self._destroyed = False
        self._opts = {}
        self._grid_weights = {}
        self._configure(kw)
        if master is not self:
            master._children.append(self)

    # -- options
    def _configure(self, kw):
        for key, value in (kw or {}).items():
            key = str(key)
            if key in ('cnf', 'conf'):
                if isinstance(value, dict):
                    self._configure(value)
                continue
            self._opts[key] = value

    def configure(self, cnf=None, **kw):
        if isinstance(cnf, dict):
            self._configure(cnf)
        self._configure(kw)
        if isinstance(cnf, dict) and not cnf and not kw:
            return dict(self._opts)
        if cnf is None and not kw:
            return dict(self._opts)
        return None

    config = configure

    def cget(self, key):
        return self._opts.get(str(key), '')

    def __getitem__(self, key):
        return self.cget(key)

    def __setitem__(self, key, value):
        self._configure({key: value})

    def keys(self):
        return list(self._opts)

    def _opt(self, *names, **kw):
        default = kw.get('default')
        for name in names:
            if name in self._opts and self._opts[name] is not None:
                return self._opts[name]
        return default

    def _bg(self, default=_GREY):
        owner = self
        while owner is not None:
            found = owner._opts.get('bg', owner._opts.get('background'))
            if found:
                return _rgb(found, default)
            owner = owner.master if owner.master is not owner else None
        return _rgb(default)

    # -- geometry managers
    def pack(self, cnf=None, **kw):
        self._pack = dict(cnf or {}, **kw)
        self._grid = None
        self._place = None
        return self

    pack_configure = pack

    def pack_forget(self):
        self._pack = None

    pack_forget_ = pack_forget

    def grid(self, cnf=None, **kw):
        self._grid = dict(cnf or {}, **kw)
        self._pack = None
        self._place = None
        return self

    grid_configure = grid

    def grid_forget(self):
        self._grid = None

    def place(self, cnf=None, **kw):
        self._place = dict(cnf or {}, **kw)
        self._pack = None
        self._grid = None
        return self

    place_configure = place

    def place_forget(self):
        self._place = None

    def pack_propagate(self, flag=None):
        return None

    propagate = pack_propagate

    def grid_rowconfigure(self, index, cnf=None, **kw):
        self._grid_weights[('row', _num(index))] = dict(cnf or {}, **kw)
        return None

    grid_columnconfigure = grid_rowconfigure
    rowconfigure = grid_rowconfigure
    columnconfigure = grid_rowconfigure

    def grid_propagate(self, flag=None):
        return None

    # -- events
    def bind(self, sequence=None, func=None, add=None):
        if sequence is not None:
            self._binds[str(sequence)] = func
        return 'bind%d' % len(self._binds)

    def bind_all(self, sequence=None, func=None, add=None):
        return None

    def unbind(self, sequence=None, funcid=None):
        self._binds.pop(str(sequence), None)
        return None

    def event_generate(self, sequence, **kw):
        """Fire a binding by hand, since nothing can really be clicked or typed."""
        callback = self._binds.get(str(sequence))
        if callback is None:
            return None
        event = types.SimpleNamespace(type=sequence, widget=self, x=0, y=0, delta=0, key='', char='', num=0, width=_num(kw.get('width')), height=_num(kw.get('height')))
        for key, value in kw.items():
            setattr(event, key, value)
        try:
            return callback(event)
        except TypeError:
            return callback()
        except Exception:
            traceback.print_exc()
            return None

    def focus_set(self):
        _focus[0] = self

    focus = focus_set
    focus_force = focus_set

    def focus_get(self):
        return _focus[0]

    def after(self, ms, func=None, *args):
        root = self.toplevel or self.tk
        if root is None or root is self:
            return None
        return root.after(ms, func, *args)

    def after_idle(self, func, *args):
        return self.after(0, func, *args)

    def after_cancel(self, identifier):
        root = self.toplevel or self.tk
        if root is not None and root is not self:
            root.after_cancel(identifier)

    def update(self):
        root = self.toplevel or self.tk
        if root is not None and root is not self:
            root.update()

    update_idletasks = update

    def winfo_toplevel(self):
        return self.toplevel or self.tk

    def winfo_master(self):
        return self.master

    def winfo_children(self):
        return list(self._children)

    def winfo_width(self):
        return self._request()[0]

    def winfo_height(self):
        return self._request()[1]

    def winfo_reqwidth(self):
        return self._request()[0]

    def winfo_reqheight(self):
        return self._request()[1]

    def winfo_x(self):
        return 0

    winfo_y = winfo_x
    winfo_rootx = winfo_x
    winfo_rooty = winfo_x
    winfo_screenwidth = lambda self: 1280
    winfo_screenheight = lambda self: 800
    winfo_ismapped = lambda self: 1
    winfo_viewable = lambda self: 1
    winfo_exists = lambda self: 0 if self._destroyed else 1
    winfo_pointerx = lambda self: 0
    winfo_pointery = lambda self: 0

    def clipboard_clear(self):
        self._clipboard = ''

    def clipboard_append(self, text):
        self._clipboard = getattr(self, '_clipboard', '') + str(text)

    def clipboard_get(self):
        return getattr(self, '_clipboard', '')

    def selection_get(self):
        return getattr(self, '_clipboard', '')

    def selection_clear(self):
        self._clipboard = ''

    def bell(self, *a):
        return None

    def destroy(self):
        self._destroyed = True
        if self.master is not None and self in self.master._children:
            self.master._children.remove(self)

    def _request(self):
        return (1, 1)

    def _paint(self, draw, x, y, w, h):
        return None


class Widget(Misc):
    """A widget that is drawn: a background, an optional 3D border, then its content and children."""

    _fill_default = _GREY
    _pad = 0

    def __init__(self, master=None, cnf=None, **kw):
        Misc.__init__(self, master)
        self._text = ''
        self._value = ''
        self._configure(cnf or {})
        self._configure(kw)

    # -- shared content
    def _font(self):
        return _font(self._opt('font', default=('TkDefaultFont', 12)))

    def _fg(self, default='black'):
        return _rgb(self._opt('fg', 'foreground', default=default), default)

    def _padx(self):
        return _num(self._opt('padx', default=2))

    def _pady(self):
        return _num(self._opt('pady', default=1))

    def _bd(self):
        return max(0, _num(self._opt('bd', 'borderwidth', default=1)))

    def _relief(self, default=FLAT):
        return str(self._opt('relief', default=default)).lower()

    def _wrap_width(self, w):
        length = _num(self._opt('wraplength', default=0))
        if length > 0:
            return max(10, length)
        return max(10, w - 2 * self._padx() - 2 * self._bd())

    def _label_text(self):
        var = self._opt('textvariable')
        if isinstance(var, Variable):
            return var.get()
        return self._opt('text', default=self._text)

    def _surface(self, draw, x, y, w, h, bg=None, border=False, relief=None, bd=None):
        w, h = max(0, int(w)), max(0, int(h))
        if w <= 0 or h <= 0:
            return (x, y, w, h)
        colour = bg if bg is not None else self._bg(self._fill_default)
        try:
            draw.rectangle([x, y, x + w - 1, y + h - 1], fill=colour)
        except Exception:
            return (x, y, w, h)
        edge = self._bd() if bd is None else max(0, int(bd))
        if (border or edge > 0) and edge > 0:
            _frame3d(draw, (x, y, x + w - 1, y + h - 1), relief if relief is not None else self._relief(), edge, colour)
        return (x, y, w, h)

    # -- the painting entry point
    def _paint(self, draw, x, y, w, h):
        if self._destroyed or w <= 0 or h <= 0:
            return
        self._paint_content(draw, x, y, int(w), int(h))
        self._paint_children(draw, (x, y, x + w, y + h))

    def _paint_content(self, draw, x, y, w, h):
        self._surface(draw, x, y, w, h)

    def _paint_children(self, draw, box):
        for child, cx, cy, cw, ch in _positions(self, box):
            try:
                child._paint(draw, cx, cy, cw, ch)
            except Exception:
                traceback.print_exc()

    def _request(self):
        return (max(1, _num(self._opt('width'), 0)), max(1, _num(self._opt('height'), 0)))


def _frame3d(draw, box, relief, bd, colour):
    x0, y0, x1, y1 = box
    relief = str(relief or FLAT).lower()
    if relief in (FLAT, NONE) or bd <= 0:
        return
    dark, light = _shade(colour, 0.62), _shade(colour, 1.16)
    for i in range(int(bd)):
        if relief in (RAISED, RIDGE, GROOVE, SOLID):
            top, bottom = (light, dark) if relief != SUNKEN else (dark, light)
        else:
            top, bottom = dark, light
        try:
            draw.line([(x0 + i, y1 - i), (x0 + i, y0 + i), (x1 - i, y0 + i)], fill=top)
            draw.line([(x1 - i, y0 + i), (x1 - i, y1 - i), (x0 + i, y1 - i)], fill=bottom)
        except Exception:
            return


# ------------------------------------------------------------------- geometry
def _natural_size(parent):
    """How big a container wants to be: the shape of its children before any fill or expand."""
    width = height = 0
    for child in parent._children:
        if child._destroyed:
            continue
        cw, ch = child._request()
        if child._pack is not None:
            info = child._pack or {}
            padx, pady = _num(info.get('padx'), 0), _num(info.get('pady'), 0)
            if str(info.get('side', TOP)).lower() in (LEFT, RIGHT):
                width += cw + 2 * padx
                height = max(height, ch + 2 * pady)
            else:
                width = max(width, cw + 2 * padx)
                height += ch + 2 * pady
        elif child._grid is not None:
            info = child._grid or {}
            width = max(width, cw + _num(info.get('column'), 0) * 8)
            height = max(height, ch + _num(info.get('row'), 0) * 8)
        elif child._place is not None:
            info = child._place
            width = max(width, _num(info.get('x'), 0) + cw)
            height = max(height, _num(info.get('y'), 0) + ch)
        else:
            width = max(width, cw)
            height = max(height, ch)
    return (max(1, width), max(1, height))


def _positions(parent, box):
    """Where each child of parent goes inside box: pack, then grid, then place."""
    x0, y0, x1, y1 = box
    out = []
    packed = [c for c in parent._children if c._pack is not None]
    if packed:
        top, bottom, left, right = y0, y1, x0, x1
        for child in packed:
            info = child._pack or {}
            side = str(info.get('side', TOP)).lower()
            padx = _num(info.get('padx'), 0)
            pady = _num(info.get('pady'), 0)
            fill = str(info.get('fill', NONE)).lower()
            cw, ch = child._request()
            if side in (TOP, BOTTOM):
                cw = max(1, (right - left) - 2 * padx) if fill in (X, BOTH) and right > left else cw
                cy = top if side == TOP else max(top, bottom - ch)
                out.append((child, left + padx, cy + pady, cw, ch))
                if side == TOP:
                    top += ch + 2 * pady
                else:
                    bottom -= ch + 2 * pady
            else:
                ch = max(1, (bottom - top) - 2 * pady) if fill in (Y, BOTH) and bottom > top else ch
                cx = left if side == LEFT else max(left, right - cw)
                out.append((child, cx + padx, top + pady, cw, ch))
                if side == LEFT:
                    left += cw + 2 * padx
                else:
                    right -= cw + 2 * padx
    gridded = [c for c in parent._children if c._grid is not None]
    if gridded:
        cells = []
        rows = cols = 0
        for child in gridded:
            info = child._grid or {}
            row = _num(info.get('row'), 0)
            column = _num(info.get('column'), 0)
            rows, cols = max(rows, row + 1), max(cols, column + 1)
            cells.append((row, column, child, info))
        col_w = [0] * max(1, cols)
        row_h = [0] * max(1, rows)
        for row, column, child, info in cells:
            cw, ch = child._request()
            col_w[column] = max(col_w[column], cw + 2 * _num(info.get('padx'), 2))
            row_h[row] = max(row_h[row], ch + 2 * _num(info.get('pady'), 2))
        total_w, total_h = sum(col_w), sum(row_h)
        if total_w < (x1 - x0) and cols:
            spread = (x1 - x0) - total_w
            weights = [parent._grid_weights.get(('column', i), {}).get('weight', 1) for i in range(cols)] or [1]
            if parents_weight := sum(int(w) for w in weights):
                col_w = [w + spread * int(weights[i]) // parents_weight for i, w in enumerate(col_w)]
        if total_h < (y1 - y0) and rows:
            spread = (y1 - y0) - total_h
            weights = [parent._grid_weights.get(('row', i), {}).get('weight', 1) for i in range(rows)]
            if parents_weight := sum(int(w) for w in weights):
                row_h = [h + spread * int(weights[i]) // parents_weight for i, h in enumerate(row_h)]
        starts_x = [x0]
        for width in col_w:
            starts_x.append(starts_x[-1] + width)
        starts_y = [y0]
        for height in row_h:
            starts_y.append(starts_y[-1] + height)
        for row, column, child, info in cells:
            padx = _num(info.get('padx'), 2)
            pady = _num(info.get('pady'), 2)
            cw, ch = child._request()
            sticky = str(info.get('sticky', '')).lower()
            cell_w = col_w[column] - 2 * padx
            cell_h = row_h[row] - 2 * pady
            if 'n' in sticky or 's' in sticky:
                ch = min(cell_h, max(ch, 1))
            if 'e' in sticky or 'w' in sticky:
                cw = min(cell_w, max(cw, 1))
            cx = starts_x[column] + padx
            cy = starts_y[row] + pady
            if 'e' in sticky:
                cx = starts_x[column + 1] - padx - cw
            elif 'w' not in sticky:
                cx = starts_x[column] + padx + max(0, (cell_w - cw) // 2)
            if 's' in sticky:
                cy = starts_y[row + 1] - pady - ch
            elif 'n' not in sticky:
                cy = starts_y[row] + pady + max(0, (cell_h - ch) // 2)
            out.append((child, cx, cy, max(1, cw), max(1, ch)))
    for child in parent._children:
        if child._place is None:
            continue
        info = child._place
        cw = _num(info.get('width'), 0) or _num(info.get('relwidth'), 0) * (x1 - x0)
        ch = _num(info.get('height'), 0) or _num(info.get('relheight'), 0) * (y1 - y0)
        if not cw or not ch:
            need_w, need_h = child._request()
            cw = cw or need_w
            ch = ch or need_h
        cx = x0 + _num(info.get('x'), 0) + _num(info.get('relx'), 0) * (x1 - x0)
        cy = y0 + _num(info.get('y'), 0) + _num(info.get('rely'), 0) * (y1 - y0)
        ax, ay = _anchor_parts(info.get('anchor'))
        out.append((child, cx - cw * ax, cy - ch * ay, int(cw), int(ch)))
    return out


# -------------------------------------------------------------------- widgets
class Frame(Widget):
    _fill_default = _GREY

    def _paint_content(self, draw, x, y, w, h):
        self._surface(draw, x, y, w, h, relief=self._relief(FLAT))

    def _request(self):
        w = _num(self._opt('width'), 0)
        h = _num(self._opt('height'), 0)
        if w and h:
            return (w, h)
        need_w = need_h = 0
        packed = [c for c in self._children if c._pack is not None]
        graw = [c for c in self._children if c._grid is not None]
        if packed:
            widths, heights = [], 0
            horizontal = 0
            for child in packed:
                info = child._pack or {}
                cw, ch = child._request()
                padx, pady = _num(info.get('padx'), 0), _num(info.get('pady'), 0)
                if str(info.get('side', TOP)).lower() in (LEFT, RIGHT):
                    horizontal += cw + 2 * padx
                    heights = max(heights, ch + 2 * pady)
                else:
                    widths.append(cw + 2 * padx)
                    horizontal = max(horizontal, cw + 2 * padx)
                    heights += ch + 2 * pady
            need_w = max([horizontal] + widths or [0])
            need_h = heights
        for child in graw:
            info = child._grid or {}
            cw, ch = child._request()
            need_w = max(need_w, _num(info.get('column'), 0) * 0 + cw)
            need_h = max(need_h, ch + _num(info.get('row'), 0) * 24)
        return (max(1, w or need_w or 1), max(1, h or need_h or 1))


class Label(Widget):
    _fill_default = _GREY

    def _paint_content(self, draw, x, y, w, h):
        bg = self._bg()
        self._surface(draw, x, y, w, h, bg=bg, relief=self._relief(FLAT))
        image = self._opt('image')
        if image is not None and getattr(image, '_render', None) is not None:
            pil = image._render()
            if pil is not None:
                ax, ay = _anchor_parts(self._opt('anchor', default=CENTER))
                px = x + self._padx() + (w - 2 * self._padx() - pil.width) * ax
                py = y + self._pady() + (h - 2 * self._pady() - pil.height) * ay
                try:
                    draw._image.paste(pil, (int(px), int(py)))
                except Exception:
                    pass
                return
        text = self._label_text()
        if text is None or text == '':
            return
        font = self._font()
        lines = _wrap(text, font, self._wrap_width(w))
        justify = str(self._opt('justify', default=LEFT)).lower()
        anchor = self._opt('anchor', default=CENTER)
        ax, _ = _anchor_parts(anchor)
        heights = [_text_size(line, font)[1] + 2 for line in lines]
        total = sum(heights)
        cy = y + self._pady() + max(0, (h - 2 * self._pady() - total) // 2)
        for line, line_h in zip(lines, heights):
            if ax == 0.0:
                tx = x + self._padx()
                line_anchor = W
            elif ax == 1.0:
                tx = x + w - self._padx()
                line_anchor = E
            else:
                tx = x + w // 2
                line_anchor = CENTER if justify == 'center' else W if justify == LEFT else E
            _draw_text(draw, tx, cy + line_h // 2, line, font, self._fg(), line_anchor if line_anchor != W else W)
            cy += line_h

    def _request(self):
        image = self._opt('image')
        if image is not None and getattr(image, '_render', None) is not None:
            pil = image._render()
            if pil is not None:
                return (pil.width + 2 * self._padx(), pil.height + 2 * self._pady())
        font = self._font()
        text = '' if self._label_text() is None else str(self._label_text())
        lines = _wrap(text, font, _num(self._opt('wraplength'), 0))
        widths = [_text_size(line, font)[0] for line in lines] or [1]
        height = sum(_text_size(line, font)[1] + 2 for line in lines) or 1
        return (max(widths) + 2 * self._padx() + 2, height + 2 * self._pady() + 2)


class Message(Label):
    pass


class Button(Widget):
    _fill_default = (228, 228, 228)

    def _paint_content(self, draw, x, y, w, h):
        bg = self._bg(self._fill_default)
        self._surface(draw, x, y, w, h, bg=bg, border=True, relief=self._relief(RAISED), bd=max(1, self._bd()))
        _draw_text(draw, x + w // 2, y + h // 2, self._label_text(), self._font(), self._fg(), CENTER)

    def _request(self):
        font = self._font()
        text = '' if self._label_text() is None else str(self._label_text())
        tw, th = _text_size(text, font)
        return (max(_num(self._opt('width'), 0) * 8, tw + 2 * self._padx() + 16),
                max(_num(self._opt('height'), 0) * 8, th + 2 * self._pady() + 10))

    def invoke(self):
        callback = self._opt('command')
        if callable(callback):
            try:
                return callback()
            except Exception:
                traceback.print_exc()
        return None


class Entry(Widget):
    _fill_default = (255, 255, 255)

    def _value_text(self):
        var = self._opt('textvariable')
        if isinstance(var, Variable):
            return str(var.get())
        return str(self._value)

    def _paint_content(self, draw, x, y, w, h):
        bg = self._bg(self._fill_default)
        self._surface(draw, x, y, w, h, bg=bg, border=True, relief=SUNKEN, bd=max(1, self._bd()))
        shown = self._value_text()
        if self._opt('show'):
            shown = str(self._opt('show')) * len(shown)
        font = self._font()
        text_w = w - 2 * self._padx() - 2
        while shown and _text_size(shown, font)[0] > text_w:
            shown = shown[1:]
        justify = str(self._opt('justify', default=LEFT)).lower()
        if justify == 'center':
            _draw_text(draw, x + w // 2, y + h // 2, shown, font, self._fg(), CENTER)
        elif justify == 'right':
            _draw_text(draw, x + w - self._padx(), y + h // 2, shown, font, self._fg(), E)
        else:
            _draw_text(draw, x + self._padx() + 1, y + h // 2, shown, font, self._fg(), W)

    def _request(self):
        font = self._font()
        chars = _num(self._opt('width'), 20)
        return (max(_num(self._opt('width'), 0) * 8, chars * 8 + 8), _text_size('Ag', font)[1] + 10)

    def get(self):
        return self._value_text()

    def set(self, value):
        var = self._opt('textvariable')
        if isinstance(var, Variable):
            var.set(value)
        else:
            self._value = str(value)

    def delete(self, first, last=None):
        var = self._opt('textvariable')
        text = self._value_text()
        if str(first) == '0' and str(last) == END:
            text = ''
        self.set(text)
        if isinstance(var, Variable):
            var.set(text)
        else:
            self._value = text

    def insert(self, index, text):
        var = self._opt('textvariable')
        text = self._value_text() + str(text)
        if isinstance(var, Variable):
            var.set(text)
        else:
            self._value = text

    def icursor(self, index):
        return None

    def select_range(self, first, last):
        return None

    def xview(self, *a):
        return None

    xview_moveto = xview
    xview_scroll = xview


class Text(Widget):
    _fill_default = (255, 255, 255)

    def __init__(self, master=None, cnf=None, **kw):
        Widget.__init__(self, master, cnf, **kw)
        self._lines = []
        self._scroll = 0

    def insert(self, index, text, tags=None):
        text = str(text)
        if str(index) in (END, 'end-1c'):
            if self._lines:
                self._lines[-1] += text
            else:
                self._lines.append(text)
        else:
            self._lines.insert(_num(index, 0), text)
        if '\n' in text:
            flat = ''.join(self._lines).split('\n')
            self._lines = flat

    def get(self, first, last=None):
        return '\n'.join(self._lines)

    def delete(self, first, last=None):
        if str(first).lower() == '1.0' and (last is None or str(last).lower() in ('end', 'end-1c')):
            self._lines = []
        elif self._lines:
            self._lines.pop(min(len(self._lines) - 1, max(0, _num(str(first).split('.')[0], 1) - 1)))

    def see(self, index):
        return None

    def tag_add(self, *a):
        return None

    tag_configure = tag_add

    def yview(self, *a):
        self._scroll = max(0, self._scroll + _num(a[-1], 0)) if a else 0

    def _paint_content(self, draw, x, y, w, h):
        bg = self._bg(self._fill_default)
        self._surface(draw, x, y, w, h, bg=bg, border=True, relief=SUNKEN, bd=max(1, self._bd()))
        font = self._font()
        inner = w - 2 * self._padx() - 2
        cy = y + self._pady() + 1
        for line in self._lines:
            for piece in _wrap(line, font, inner):
                _draw_text(draw, x + self._padx() + 1, cy, piece, font, self._fg(), W)
                cy += _text_size(piece, font)[1] + 3
                if cy > y + h - 2:
                    return

    def _request(self):
        font = self._font()
        chars = _num(self._opt('width'), 40)
        rows = _num(self._opt('height'), 10)
        return (chars * 8 + 8, rows * (_text_size('Ag', font)[1] + 3) + 8)


class Listbox(Widget):
    _fill_default = (255, 255, 255)

    def __init__(self, master=None, cnf=None, **kw):
        Widget.__init__(self, master, cnf, **kw)
        self._items = []
        self._selection = set()

    def insert(self, index, *elements):
        for element in elements:
            if str(index) == END or _num(index, -1) < 0:
                self._items.append(str(element))
            else:
                self._items.insert(_num(index, 0), str(element))

    def delete(self, first, last=None):
        if str(first) == '0' and (last is None or str(last) in (END, 'end')):
            self._items = []
        elif self._items:
            self._items.pop(min(len(self._items) - 1, _num(first, 0)))

    def get(self, first, last=None):
        if str(first) == '0' or str(first).lower() == 'active':
            if last is None:
                return self._items[0] if self._items else None
        return '\n'.join(self._items)

    def size(self):
        return len(self._items)

    def curselection(self):
        return tuple(sorted(self._selection))

    def selection_set(self, first, last=None):
        self._selection.add(_num(first, 0))

    def selection_clear(self, first, last=None):
        if first is None:
            self._selection.clear()
        else:
            self._selection.discard(_num(first, 0))

    def see(self, index):
        return None

    def _paint_content(self, draw, x, y, w, h):
        bg = self._bg(self._fill_default)
        self._surface(draw, x, y, w, h, bg=bg, border=True, relief=SUNKEN, bd=max(1, self._bd()))
        font = self._font()
        row_h = _text_size('Ag', font)[1] + 4
        sel_bg = _rgb(self._opt('selectbackground', default='#4a6984'))
        sel_fg = _rgb(self._opt('selectforeground', default='white'), 'white')
        cy = y + 2
        for i, item in enumerate(self._items):
            if cy + row_h > y + h:
                break
            if i in self._selection:
                draw.rectangle([x + 2, cy, x + w - 3, cy + row_h], fill=sel_bg)
            _draw_text(draw, x + self._padx() + 2, cy + row_h // 2, item, font,
                       sel_fg if i in self._selection else self._fg(), W)
            cy += row_h

    def _request(self):
        font = self._font()
        chars = _num(self._opt('width'), 20)
        rows = _num(self._opt('height'), 10)
        return (chars * 8 + 8, rows * (_text_size('Ag', font)[1] + 4) + 6)


class Checkbutton(Widget):
    _fill_default = _GREY

    def _state(self):
        var = self._opt('variable')
        if isinstance(var, Variable):
            return bool(var.get())
        return bool(self._opt('onvalue', default=1) == self._opt('offvalue', default=0) and False)

    def _paint_content(self, draw, x, y, w, h):
        bg = self._bg()
        self._surface(draw, x, y, w, h, bg=bg)
        font = self._font()
        size = _text_size('Ag', font)[1]
        bx, by = x + 2, y + max(1, (h - size) // 2)
        draw.rectangle([bx, by, bx + size - 2, by + size - 2], fill=(255, 255, 255), outline=self._fg())
        if self._state():
            draw.line([(bx + 3, by + size // 2), (bx + size // 2, by + size - 5), (bx + size - 4, by + 4)],
                      fill=self._fg(), width=2)
        _draw_text(draw, bx + size + 4, y + h // 2, self._label_text(), font, self._fg(), W)

    def _request(self):
        font = self._font()
        text = '' if self._label_text() is None else str(self._label_text())
        tw, th = _text_size(text, font)
        return (tw + th + 14, max(20, th + 8))

    def invoke(self):
        var = self._opt('variable')
        if isinstance(var, Variable) and isinstance(var, BooleanVar):
            var.set(0 if var.get() else 1)
        callback = self._opt('command')
        if callable(callback):
            callback()


class Radiobutton(Checkbutton):
    def _state(self):
        var = self._opt('variable')
        if isinstance(var, Variable):
            return str(var.get()) == str(self._opt('value', default=''))
        return False

    def _paint_content(self, draw, x, y, w, h):
        bg = self._bg()
        self._surface(draw, x, y, w, h, bg=bg)
        font = self._font()
        size = _text_size('Ag', font)[1]
        bx, by = x + 2, y + max(1, (h - size) // 2)
        draw.ellipse([bx, by, bx + size - 2, by + size - 2], fill=(255, 255, 255), outline=self._fg())
        if self._state():
            draw.ellipse([bx + 4, by + 4, bx + size - 6, by + size - 6], fill=self._fg())
        _draw_text(draw, bx + size + 4, y + h // 2, self._label_text(), font, self._fg(), W)


class Scale(Widget):
    _fill_default = _GREY

    def _paint_content(self, draw, x, y, w, h):
        bg = self._bg()
        self._surface(draw, x, y, w, h, bg=bg)
        low, high = float(_num(self._opt('from_', 'from'), 0)), float(_num(self._opt('to'), 100)) or 100.0
        var = self._opt('variable')
        try:
            value = float(var.get()) if isinstance(var, Variable) else float(_num(self._opt('value', 'set'), 0))
        except (TypeError, ValueError):
            value = low
        span = (high - low) or 1.0
        fraction = max(0.0, min(1.0, (value - low) / span))
        horizontal = str(self._opt('orient', default=HORIZONTAL)).lower() == HORIZONTAL
        if horizontal:
            ty = y + h // 2
            draw.line([(x + 8, ty), (x + w - 8, ty)], fill=_shade(bg, 0.6), width=2)
            kx = x + 8 + fraction * max(1, w - 16)
            draw.rectangle([kx - 5, ty - 7, kx + 5, ty + 7], fill=(240, 240, 240), outline=_shade(bg, 0.5))
        else:
            tx = x + w // 2
            draw.line([(tx, y + 8), (tx, y + h - 8)], fill=_shade(bg, 0.6), width=2)
            ky = y + h - 8 - fraction * max(1, h - 16)
            draw.rectangle([tx - 7, ky - 5, tx + 7, ky + 5], fill=(240, 240, 240), outline=_shade(bg, 0.5))

    def _request(self):
        return (120, 20)


class Scrollbar(Widget):
    _fill_default = (217, 217, 217)

    def _paint_content(self, draw, x, y, w, h):
        bg = (240, 240, 240)
        self._surface(draw, x, y, w, h, bg=bg, border=True, relief=SUNKEN, bd=1)
        first = float(_num(self._opt('first'), 0))
        vertical = str(self._opt('orient', default=VERTICAL)).lower() == VERTICAL
        if vertical:
            top = y + int(first * h)
            draw.rectangle([x + 1, top, x + w - 2, min(y + h - 2, top + max(10, h // 4))], fill=(190, 190, 190))
        else:
            left = x + int(first * w)
            draw.rectangle([left, y + 1, min(x + w - 2, left + max(10, w // 4)), y + h - 2], fill=(190, 190, 190))

    def _request(self):
        if str(self._opt('orient', default=VERTICAL)).lower() == VERTICAL:
            return (14, 120)
        return (120, 14)

    def set(self, first, last):
        self._opts['first'] = first


class Canvas(Widget):
    _fill_default = _GREY

    def __init__(self, master=None, cnf=None, **kw):
        Widget.__init__(self, master, cnf, **kw)
        self._items = []
        self._next_id = 1
        self._scroll_region = (0, 0, 0, 0)

    # -- items
    def _add(self, kind, coords, opts):
        item = {'id': self._next_id, 'kind': kind, 'coords': [float(c) for c in coords], 'opts': dict(opts)}
        self._next_id += 1
        self._items.append(item)
        return item['id']

    def _find(self, identifier):
        if isinstance(identifier, int):
            for item in self._items:
                if item['id'] == identifier:
                    return item
            return None
        text = str(identifier)
        if text == 'all':
            return None
        wanted = set()
        for item in self._items:
            tags = item['opts'].get('tags', [])
            if isinstance(tags, str):
                tags = [tags]
            if text in [str(t) for t in tags]:
                wanted.add(item['id'])
        if wanted:
            self._picked = wanted
        return None

    def create_line(self, *args, **kw):
        return self._add('line', args, kw)

    def create_rectangle(self, *args, **kw):
        return self._add('rectangle', args, kw)

    def create_oval(self, *args, **kw):
        return self._add('oval', args, kw)

    def create_polygon(self, *args, **kw):
        return self._add('polygon', args, kw)

    def create_arc(self, *args, **kw):
        return self._add('arc', args, kw)

    def create_text(self, *args, **kw):
        return self._add('text', args, kw)

    def create_image(self, *args, **kw):
        return self._add('image', args, kw)

    def create_bitmap(self, *args, **kw):
        return self._add('bitmap', args, kw)

    def create_window(self, *args, **kw):
        return self._add('window', args, kw)

    def coords(self, identifier, *args):
        for item in self._items:
            if item['id'] == identifier:
                if args:
                    item['coords'] = [float(c) for c in args]
                return list(item['coords'])
        return None

    def itemconfig(self, identifier, **kw):
        for item in self._items:
            if item['id'] == identifier or (isinstance(kw.get('tags'), str) and kw['tags'] == str(item['opts'].get('tags'))):
                item['opts'].update(kw)
        return None

    itemconfigure = itemconfig

    def itemcget(self, identifier, key):
        for item in self._items:
            if item['id'] == identifier:
                return item['opts'].get(key, '')
        return ''

    def delete(self, *identifiers):
        if not identifiers:
            return
        for identifier in identifiers:
            if str(identifier) == 'all':
                self._items = []
                continue
            self._items = [item for item in self._items if item['id'] != identifier]

    def find_all(self):
        return tuple(item['id'] for item in self._items)

    def find_withtag(self, tag):
        out = []
        for item in self._items:
            tags = item['opts'].get('tags', [])
            if isinstance(tags, str):
                tags = [tags]
            if str(tag) in [str(t) for t in tags]:
                out.append(item['id'])
        return tuple(out)

    def find_closest(self, x, y):
        return (self._items[-1]['id'],) if self._items else ()

    def move(self, identifier, dx, dy):
        for item in self._items:
            if item['id'] == identifier:
                item['coords'] = [c + (dx if i % 2 == 0 else dy) for i, c in enumerate(item['coords'])]
        return None

    def moveto(self, identifier, x, y):
        for item in self._items:
            if item['id'] == identifier and item['coords']:
                x0, y0 = item['coords'][0], item['coords'][1]
                self.move(identifier, x - x0, y - y0)
        return None

    def scale(self, identifier, x, y, sx, sy):
        for item in self._items:
            if item['id'] == identifier:
                item['coords'] = [c * (sx if i % 2 == 0 else sy) for i, c in enumerate(item['coords'])]
        return None

    def tag_raise(self, *a):
        return None

    tag_lower = tag_raise
    tag_bind = lambda self, *a, **k: 'bind0'
    tag_unbind = lambda self, *a, **k: None
    tag_configure = lambda self, *a, **k: None

    def bbox(self, *a):
        for item in self._items:
            if a and item['id'] == a[0]:
                cx = item['coords']
                if len(cx) >= 4:
                    return (min(cx[0::2]), min(cx[1::2]), max(cx[0::2]), max(cx[1::2]))
                if len(cx) >= 2:
                    return (cx[0], cx[1], cx[0] + 1, cx[1] + 1)
        return None

    def config(self, cnf=None, **kw):
        if 'scrollregion' in kw:
            self._scroll_region = kw['scrollregion']
        return Widget.configure(self, cnf, **kw)

    configure = config

    def xview(self, *a):
        return (0.0, 1.0)

    def yview(self, *a):
        return (0.0, 1.0)

    xview_moveto = xview_scroll = yview_moveto = yview_scroll = xview

    def canvasx(self, x, *a):
        return x

    canvasy = canvasx

    def postscript(self, *a, **k):
        return ''

    # -- painting
    def _paint_content(self, draw, x, y, w, h):
        bg = self._bg()
        self._surface(draw, x, y, w, h, bg=bg, relief=self._relief(FLAT), bd=max(0, _num(self._opt('highlightthickness'), 0)))
        for item in self._items:
            try:
                self._paint_item(draw, item, x, y, w, h)
            except Exception:
                traceback.print_exc()

    def _paint_item(self, draw, item, ox, oy, w, h):
        opts = item['opts']
        if str(opts.get('state', NORMAL)).lower() == 'hidden':
            return
        coords = [ox + c for c in item['coords']]
        kind = item['kind']
        fill = opts.get('fill')
        outline = opts.get('outline')
        width = max(1, _num(opts.get('width'), 1))
        if kind == 'line':
            points = list(zip(coords[0::2], coords[1::2]))
            if len(points) >= 2:
                draw.line(points, fill=_rgb(fill, 'black'), width=width, joint='curve' if len(points) > 2 else None)
        elif kind == 'rectangle':
            if len(coords) >= 4:
                draw.rectangle(coords[:4], fill=_rgb(fill, None) if fill else None,
                               outline=_rgb(outline, 'black') if outline else None, width=width)
        elif kind == 'oval':
            if len(coords) >= 4:
                draw.ellipse(coords[:4], fill=_rgb(fill, None) if fill else None,
                             outline=_rgb(outline, 'black') if outline else None, width=width)
        elif kind == 'polygon':
            points = list(zip(coords[0::2], coords[1::2]))
            if len(points) >= 3:
                draw.polygon(points, fill=_rgb(fill, None) if fill else None,
                             outline=_rgb(outline, 'black') if outline else None)
        elif kind == 'arc':
            if len(coords) >= 4:
                start = float(_num(opts.get('start'), 0))
                extent = float(_num(opts.get('extent'), 90))
                style = str(opts.get('style', 'pieslice')).lower()
                box = coords[:4]
                draw.arc(box, start=start, end=start + extent, fill=_rgb(outline, 'black'), width=width)
                if style == 'pieslice' and fill:
                    cx, cy = (box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0
                    radius = min(box[2] - box[0], box[3] - box[1]) / 2.0
                    points = [(cx, cy)]
                    steps = max(4, int(abs(extent) / 12))
                    for i in range(steps + 1):
                        angle = math.radians(start + extent * i / steps)
                        points.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
                    draw.polygon(points, fill=_rgb(fill))
        elif kind == 'text':
            if len(coords) >= 2:
                _draw_text(draw, coords[0], coords[1], opts.get('text', ''), _font(opts.get('font')),
                           _rgb(fill, 'black'), opts.get('anchor', CENTER))
        elif kind == 'image':
            image = opts.get('image')
            if image is not None and getattr(image, '_render', None) is not None:
                pil = image._render()
                if pil is not None and len(coords) >= 2:
                    ax, ay = _anchor_parts(opts.get('anchor', CENTER))
                    px = coords[0] - pil.width * ax
                    py = coords[1] - pil.height * ay
                    draw._image.paste(pil, (int(px), int(py)))

    def _request(self):
        return (max(1, _num(self._opt('width'), 0) or 300), max(1, _num(self._opt('height'), 0) or 200))


class LabelFrame(Frame):
    def _paint_content(self, draw, x, y, w, h):
        bg = self._bg()
        self._surface(draw, x, y, w, h, bg=bg)
        _frame3d(draw, (x, y + 6, x + w - 1, y + h - 1), GROOVE, 1, bg)
        _draw_text(draw, x + 10, y + 8, self._label_text(), self._font(), self._fg(), W)

    def _request(self):
        w, h = Frame._request(self)
        return (max(w + 12, 40), max(h + 18, 30))


class Menubutton(Button):
    def _paint_content(self, draw, x, y, w, h):
        Button._paint_content(self, draw, x, y, w, h)
        draw.polygon([(x + w - 12, y + h // 2 - 2), (x + w - 6, y + h // 2 - 2), (x + w - 9, y + h // 2 + 3)],
                     fill=self._fg())


class Menu(Widget):
    """A menu bar entry: it can be built, but nothing can be opened, so it draws nothing itself."""

    def __init__(self, master=None, cnf=None, **kw):
        Widget.__init__(self, master, cnf, **kw)
        self._entries = []

    def add_command(self, cnf=None, **kw):
        self._entries.append(('command', dict(cnf or {}, **kw)))
        return len(self._entries)

    def add_separator(self, cnf=None, **kw):
        self._entries.append(('separator', {}))
        return len(self._entries)

    def add_cascade(self, cnf=None, **kw):
        self._entries.append(('cascade', dict(cnf or {}, **kw)))
        return len(self._entries)

    add_checkbutton = add_command
    add_radiobutton = add_command

    def add(self, kind, cnf=None, **kw):
        return self.add_command(cnf, **kw)

    def post(self, x, y):
        return None

    unpost = post

    def delete(self, index1, index2=None):
        self._entries = []

    def entryconfig(self, index, **kw):
        return None

    def _request(self):
        return (1, 1)


class PanedWindow(Frame):
    def add(self, child, **kw):
        if child not in self._children:
            self._children.append(child)
        child.pack(side=LEFT, fill=BOTH, expand=1)
        return child

    def remove(self, child):
        if child in self._children:
            self._children.remove(child)


class Toplevel(Widget):
    """A second window: it is drawn as its own frame, after the main one."""

    def __init__(self, master=None, cnf=None, **kw):
        Widget.__init__(self, master, cnf, **kw)
        self._geom = None
        self._title = ''
        window = getattr(self, 'toplevel', None)
        self.window = window if isinstance(window, (Tk, Toplevel)) else None
        if isinstance(self.window, Tk):
            self.window._toplevels.append(self)

    def geometry(self, spec=None):
        if spec is None:
            return self._geom or ''
        self._geom = str(spec)
        return None

    wm_geometry = geometry

    def title(self, text=None):
        if text is None:
            return self._title
        self._title = str(text)
        return None

    wm_title = title

    def resizable(self, width=None, height=None):
        return None

    wm_resizable = resizable
    protocol = lambda self, *a, **k: None
    transient = lambda self, *a, **k: None
    grab_set = lambda self, *a, **k: None
    grab_release = lambda self, *a, **k: None
    attributes = lambda self, *a, **k: None
    iconphoto = lambda self, *a, **k: None
    minsize = lambda self, *a, **k: None
    maxsize = lambda self, *a, **k: None
    lift = lambda self, *a, **k: None
    focus_force = lambda self, *a, **k: None
    withdraw = lambda self, *a, **k: None
    deiconify = lambda self, *a, **k: None
    state = lambda self, *a, **k: 'normal'

    def destroy(self):
        Widget.destroy(self)
        self._destroyed = True
        window = getattr(self, 'window', None)
        if isinstance(window, Tk) and self in window._toplevels:
            window._toplevels.remove(self)


# ------------------------------------------------------------------------ root
def _default_root():
    return _default[0]


_default = [None]


class Tk(Misc):
    """The main window. Its size comes from `geometry` or from what it contains; it is drawn with Pillow."""

    def __init__(self, screenName=None, baseName=None, className='Tk', useTk=True, sync=False, use=None, **kw):
        self.master = None
        self.tk = self
        self.toplevel = self
        self._children = []
        self._binds = {}
        self._pack = None
        self._grid = None
        self._place = None
        self._opts = {}
        self._grid_weights = {}
        self._destroyed = False
        self._geom = None
        self._title = ''
        self._resizable = (True, True)
        self._queue = []
        self._seq = 0
        self._toplevels = []
        self._clipboard = ''
        self._last_frame = None
        self._updates = 0
        self._configure(kw)
        _default[0] = self
        _windows.append(self)

    # -- window
    def title(self, text=None):
        if text is None:
            return self._title
        self._title = str(text)
        return None

    wm_title = title

    def geometry(self, spec=None):
        if spec is None:
            return self._geom or ''
        self._geom = str(spec)
        return None

    wm_geometry = geometry

    def resizable(self, width=None, height=None):
        if width is None:
            return self._resizable
        self._resizable = (bool(width), bool(height))
        return None

    wm_resizable = resizable

    def minsize(self, *a):
        return None

    def maxsize(self, *a):
        return None

    def protocol(self, name=None, func=None):
        return None

    def attributes(self, *a, **k):
        return None

    def iconphoto(self, *a, **k):
        return None

    def iconname(self, *a, **k):
        return ''

    def overrideredirect(self, *a, **k):
        return None

    def lift(self, *a, **k):
        return None

    def lower(self, *a, **k):
        return None

    def withwithdraw(self, *a, **k):
        return None

    def deiconify(self, *a, **k):
        return None

    def state(self, *a):
        return 'normal'

    def mainloop(self, n=0):
        """Run the program's `after` callbacks, drawing a frame each time round, until it stops."""
        if self._destroyed:
            return None
        start = time.perf_counter()
        note = ''
        self._draw_and_keep()
        if not _can_draw():
            return None
        passes = 1                     # counted even when a frame could not be drawn, so the loop always ends
        while not self._destroyed:
            ran = self._drain()
            if not ran:
                if not self._queue:
                    break
                due = self._queue[0][0] - time.perf_counter()
                if due > 0:
                    time.sleep(min(due, 0.02))
                continue
            self._draw_and_keep()
            passes += 1
            if passes >= MAX_FRAMES:
                note = ('tkinter stopped after %d frames so the sandbox stays quick. Draw fewer frames, or call '
                        'tkinter.set_frame_limit(n) before mainloop.' % MAX_FRAMES)
                break
            if time.perf_counter() - start > MAX_SECONDS:
                note = ('tkinter stopped after %.1f seconds so the sandbox stays quick. Draw fewer frames, or call '
                        'tkinter.set_frame_limit(n).' % MAX_SECONDS)
                break
        if note:
            print(note)

    def update(self):
        """Handle what is due now and draw one frame (for `while True: root.update()` loops)."""
        if not _can_draw():
            raise TclError('tkinter cannot draw here: Pillow is not loaded in this sandbox.')
        self._updates += 1
        self._drain()
        self._draw_and_keep()
        if self._updates > MAX_FRAMES * 2:
            raise TclError('tkinter was updated more than %d times so the sandbox stays quick. Call '
                           'tkinter.set_frame_limit(n).' % (MAX_FRAMES * 2))

    update_idletasks = update

    def after(self, ms, func=None, *args):
        if func is None:
            return None
        self._seq += 1
        due = time.perf_counter() + max(0, _num(ms, 0)) / 1000.0
        self._queue.append((due, self._seq, func, args))
        self._queue.sort(key=lambda entry: (entry[0], entry[1]))
        return 'after#%d' % self._seq

    def after_idle(self, func, *args):
        return self.after(0, func, *args)

    def after_cancel(self, identifier):
        try:
            number = int(str(identifier).split('#')[1])
        except (IndexError, ValueError):
            return None
        self._queue = [entry for entry in self._queue if entry[1] != number]
        return None

    def _drain(self):
        """Run every callback that is due, newest state first. Errors are reported and the loop carries on, as Tk does."""
        now = time.perf_counter()
        ran = 0
        while self._queue and not self._destroyed:
            due, _, func, args = self._queue[0]
            if due > now:
                break
            self._queue.pop(0)
            ran += 1
            try:
                func(*args)
            except Exception:
                traceback.print_exc()
            if ran > 5000:
                break
        return ran

    def destroy(self):
        self._destroyed = True
        self._queue = []
        for window in list(self._toplevels):
            window.destroy()
        self._toplevels = []

    quit = destroy

    def _window_size(self):
        width = height = None
        if self._geom:
            match = re.match(r'\s*(\d+)?x(\d+)?([+-]\d+)?([+-]\d+)?', self._geom)
            if match:
                width = int(match.group(1)) if match.group(1) else None
                height = int(match.group(2)) if match.group(2) else None
        need_w, need_h = _natural_size(self)
        if width is None:
            width = need_w
        if height is None:
            height = need_h
        return (max(40, min(2000, int(width))), max(40, min(2000, int(height))))

    def _draw(self):
        if not _load_pillow():
            return None
        width, height = self._window_size()
        image = Image.new('RGB', (width, height), self._bg(_GREY))
        draw = _new_draw(image)
        if draw is None:
            return None
        for child, x, y, w, h in _positions(self, (0, 0, width, height)):
            try:
                child._paint(draw, x, y, w, h)
            except Exception:
                traceback.print_exc()
        return image

    def _draw_toplevels(self):
        out = []
        for window in list(self._toplevels):
            if window._destroyed or Image is None:
                continue
            width = height = None
            if window._geom:
                match = re.match(r'\s*(\d+)?x(\d+)?', str(window._geom))
                if match:
                    width = int(match.group(1)) if match.group(1) else None
                    height = int(match.group(2)) if match.group(2) else None
            need_w, need_h = _natural_size(window)
            width = max(60, min(2000, int(width or need_w)))
            height = max(40, min(2000, int(height or need_h)))
            image = Image.new('RGB', (width, height), window._bg(_GREY))
            draw = _new_draw(image)
            if draw is None:
                continue
            for child, x, y, w, h in _positions(window, (0, 0, width, height)):
                try:
                    child._paint(draw, x, y, w, h)
                except Exception:
                    traceback.print_exc()
            out.append(image)
        return out

    def _draw_and_keep(self):
        image = self._draw()
        if image is None:
            return
        _count[0] += 1
        self._last_frame = image
        FRAMES.append((_count[0], image))
        for extra in self._draw_toplevels():
            _count[0] += 1
            FRAMES.append((_count[0], extra))


# ------------------------------------------------------------------ functions
def mainloop(n=0):
    root = _default_root()
    if root is not None:
        root.mainloop(n)


def update():
    root = _default_root()
    if root is not None:
        root.update()


def getboolean(value):
    return _truth(value)


def getint(value):
    return int(float(value))


def getdouble(value):
    return float(value)


def _noop(*a, **k):
    return None


# the dialogs live in their own modules; keep the names importable from tkinter too
from . import messagebox, filedialog, colorchooser, simpledialog  # noqa: E402

_install_imagetk()
_install_show()

__all__ = ['Tk', 'Toplevel', 'Canvas', 'Frame', 'Label', 'LabelFrame', 'Button', 'Entry', 'Text', 'Listbox',
           'Checkbutton', 'Radiobutton', 'Scale', 'Scrollbar', 'Menu', 'Menubutton', 'PanedWindow', 'Message',
           'PhotoImage', 'BitmapImage', 'Variable', 'StringVar', 'IntVar', 'DoubleVar', 'BooleanVar', 'TclError',
           'mainloop', 'update', 'getboolean', 'getint', 'getdouble', 'set_frame_limit', 'frames',
           'messagebox', 'filedialog', 'colorchooser', 'simpledialog',
           'N', 'S', 'E', 'W', 'NW', 'NE', 'SW', 'SE', 'CENTER', 'NSEW', 'NS', 'EW', 'LEFT', 'RIGHT', 'TOP',
           'BOTTOM', 'X', 'Y', 'BOTH', 'HORIZONTAL', 'VERTICAL', 'END', 'INSERT', 'ANCHOR', 'SEL', 'CURRENT',
           'NORMAL', 'DISABLED', 'ACTIVE', 'HIDDEN', 'FLAT', 'RAISED', 'SUNKEN', 'GROOVE', 'RIDGE', 'SOLID',
           'YES', 'NO', 'TRUE', 'FALSE', 'ON', 'OFF', 'WORD', 'CHAR', 'NONE', 'TkVersion', 'TclVersion']
