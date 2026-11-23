"""ttk widgets: the same drawing, with the Tk themes' quieter look.

Everything here is a thin wrapper around the tkinter widgets, plus the few that only exist in ttk: Notebook,
Treeview, Progressbar, Separator, Combobox and Sizegrip. Style settings are accepted and ignored.
"""

from . import (Frame as _Frame, Label as _Label, LabelFrame as _LabelFrame, Button as _Button, Entry as _Entry,
               Checkbutton as _Checkbutton, Radiobutton as _Radiobutton, Scrollbar as _Scrollbar, Scale as _Scale,
               PanedWindow as _PanedWindow, Menubutton as _Menubutton, Widget, _draw_text, _font, _num, _rgb,
               _text_size, _truth, _shade, _frame3d, BOTH, LEFT, NSEW, TOP, VERTICAL, HORIZONTAL, W, END)

BG = (240, 240, 240)


class Style:
    """Style().configure(...), map, lookup and theme_use all answer, and change nothing: there is one theme."""

    def __init__(self, master=None):
        self.master = master
        self._settings = {}

    def configure(self, style=None, **kw):
        if style:
            self._settings.setdefault(style, {}).update(kw)
        return None

    def map(self, style=None, **kw):
        return None

    def lookup(self, style, option, state=None, default=None):
        return self._settings.get(style, {}).get(option, default if default is not None else '')

    def theme_use(self, name=None):
        if name is None:
            return 'sandbox'
        return None

    def theme_names(self):
        return ('sandbox', 'clam', 'default')

    def layout(self, *a, **k):
        return []

    def element_names(self):
        return ()


class Frame(_Frame):
    _fill_default = BG


class Label(_Label):
    _fill_default = BG


class LabelFrame(_LabelFrame):
    _fill_default = BG


class Button(_Button):
    _fill_default = (232, 232, 232)


class Menubutton(_Menubutton):
    _fill_default = (232, 232, 232)


class Checkbutton(_Checkbutton):
    _fill_default = BG


class Radiobutton(_Radiobutton):
    _fill_default = BG


class Scrollbar(_Scrollbar):
    pass


class Scale(_Scale):
    _fill_default = BG


class Separator(Widget):
    _fill_default = BG

    def _paint_content(self, draw, x, y, w, h):
        colour = _shade(self._bg(), 0.75)
        if str(self._opt('orient', default=HORIZONTAL)).lower() == HORIZONTAL:
            draw.line([(x, y + h // 2), (x + w - 1, y + h // 2)], fill=colour)
        else:
            draw.line([(x + w // 2, y), (x + w // 2, y + h - 1)], fill=colour)

    def _request(self):
        if str(self._opt('orient', default=HORIZONTAL)).lower() == HORIZONTAL:
            return (80, 8)
        return (8, 80)


class Progressbar(Widget):
    _fill_default = BG

    def _paint_content(self, draw, x, y, w, h):
        trough = (222, 222, 222) if self._bg() == BG else _shade(self._bg(), 0.9)
        draw.rectangle([x, y, x + w - 1, y + h - 1], fill=trough, outline=_shade(trough, 0.8))
        maximum = float(_num(self._opt('maximum'), 100)) or 100.0
        value = float(_num(self._opt('value'), 0))
        fraction = max(0.0, min(1.0, value / maximum))
        fill = _rgb('#3b82f6')
        if str(self._opt('orient', default=HORIZONTAL)).lower() == HORIZONTAL:
            draw.rectangle([x + 1, y + 1, x + 1 + int((w - 2) * fraction), y + h - 2], fill=fill)
        else:
            top = y + h - 1 - int((h - 2) * fraction)
            draw.rectangle([x + 1, top, x + w - 2, y + h - 2], fill=fill)

    def _request(self):
        return (120, 18)

    def step(self, amount=1):
        self._opts['value'] = _num(self._opts.get('value'), 0) + _num(amount, 1)

    def start(self, interval=None):
        return None

    def stop(self):
        return None


class Sizegrip(Widget):
    def _paint_content(self, draw, x, y, w, h):
        colour = _shade(self._bg(), 0.7)
        for i in range(3):
            draw.line([(x + w - 3 - i * 4, y + h - 2), (x + w - 2, y + h - 3 - i * 4)], fill=colour)

    def _request(self):
        return (14, 14)


class Combobox(_Entry):
    """An entry with a list of choices; the drop-down cannot be opened, so the first value is shown if empty."""

    def __init__(self, master=None, cnf=None, **kw):
        _Entry.__init__(self, master, cnf, **kw)
        self._choices = []
        values = self._opt('values')
        if values:
            self._choices = [str(v) for v in values]

    def _paint_content(self, draw, x, y, w, h):
        bg = self._bg((255, 255, 255))
        self._surface(draw, x, y, w, h, bg=bg, border=True, relief='flat', bd=1)
        draw.rectangle([x + w - 18, y + 1, x + w - 2, y + h - 2], fill=(228, 228, 228))
        draw.polygon([(x + w - 13, y + h // 2 - 2), (x + w - 5, y + h // 2 - 2), (x + w - 9, y + h // 2 + 4)],
                     fill=(60, 60, 60))
        shown = self._value_text()
        _draw_text(draw, x + 5, y + h // 2, shown, self._font(), self._fg(), W)

    def _request(self):
        return (140, 24)

    def set(self, value):
        _Entry.set(self, value)

    def current(self, index=None):
        if index is None:
            try:
                return self._choices.index(self._value_text())
            except ValueError:
                return -1
        if 0 <= _num(index) < len(self._choices):
            self.set(self._choices[_num(index)])
        return None


class Spinbox(_Entry):
    def _paint_content(self, draw, x, y, w, h):
        _Entry._paint_content(self, draw, x, y, w, h)
        draw.rectangle([x + w - 15, y + 1, x + w - 2, y + h - 2], fill=(232, 232, 232))
        mid = y + h // 2
        draw.polygon([(x + w - 12, mid - 2), (x + w - 5, mid - 2), (x + w - 8, mid - 6)], fill=(60, 60, 60))
        draw.polygon([(x + w - 12, mid + 2), (x + w - 5, mid + 2), (x + w - 8, mid + 6)], fill=(60, 60, 60))

    def _request(self):
        return (110, 24)


class Notebook(Widget):
    """Tabs: `add(page, text='One')` then `select(page)`. Only the selected page is drawn."""

    _fill_default = BG

    def __init__(self, master=None, cnf=None, **kw):
        Widget.__init__(self, master, cnf, **kw)
        self._pages = []
        self._selected = 0
        self._tabs = {}

    def add(self, child, **kw):
        if child not in [page for page, _ in self._pages]:
            self._pages.append([child, kw])
            if child.master is not self:
                try:
                    child.master = self
                except Exception:
                    pass
            self._tabs[id(child)] = kw
        return child

    def insert(self, pos, child, **kw):
        self._pages.insert(_num(pos, 0), [child, kw])
        self._tabs[id(child)] = kw
        return child

    def select(self, tab=None):
        if tab is None:
            return str(self._selected)
        for index, (page, info) in enumerate(self._pages):
            if page is tab or info.get('text') == tab or str(index) == str(tab):
                self._selected = index
                break
        return None

    def index(self, tab):
        for index, (page, info) in enumerate(self._pages):
            if page is tab:
                return index
        return -1

    def forget(self, tab):
        for index, (page, info) in enumerate(self._pages):
            if page is tab or str(index) == str(tab):
                self._pages.pop(index)
                self._selected = max(0, min(self._selected, len(self._pages) - 1))
                return None
        return None

    def tabs(self):
        return tuple(str(index) for index in range(len(self._pages)))

    def _tab_labels(self):
        return [str((info or {}).get('text') or 'Tab %d' % (index + 1)) for index, (page, info) in enumerate(self._pages)]

    def _paint_content(self, draw, x, y, w, h):
        bg = self._bg()
        self._surface(draw, x, y, w, h, bg=bg)
        font = self._font()
        tab_h = _text_size('Ag', font)[1] + 8
        tx = x + 2
        for index, label in enumerate(self._tab_labels()):
            width = _text_size(label, font)[0] + 18
            selected = index == self._selected
            draw.rectangle([tx, y + 1, tx + width, y + tab_h + (0 if selected else 2)],
                           fill=(252, 252, 252) if selected else (226, 226, 226),
                           outline=_shade(bg, 0.7))
            _draw_text(draw, tx + width // 2, y + 1 + tab_h // 2, label, font, (20, 20, 20), 'center')
            tx += width + 2
        draw.line([(x, y + tab_h + 1), (x + w - 1, y + tab_h + 1)], fill=_shade(bg, 0.7))
        if not self._pages:
            return
        page = self._pages[min(self._selected, len(self._pages) - 1)][0]
        inner = (x + 1, y + tab_h + 2, x + w - 1, y + h - 1)
        try:
            page._paint(draw, inner[0], inner[1], inner[2] - inner[0], inner[3] - inner[1])
        except Exception:
            pass

    def _paint_children(self, draw, box):
        return None

    def _request(self):
        return (240, 160)


class Treeview(Widget):
    """A table: `heading`, `column`, `insert` and tag colours. Rows are drawn, header included."""

    _fill_default = (255, 255, 255)

    def __init__(self, master=None, cnf=None, **kw):
        Widget.__init__(self, master, cnf, **kw)
        self._columns = [str(c) for c in (self._opt('columns') or [])]
        self._headings = {}
        self._rows = []
        self._widths = {}
        self._tags = {}

    def heading(self, column, **kw):
        self._headings[str(column)] = kw

    def column(self, column, **kw):
        if 'width' in kw:
            self._widths[str(column)] = _num(kw['width'], 100)

    def insert(self, parent, index, iid=None, **kw):
        self._rows.append({'iid': iid or 'I%03d' % (len(self._rows) + 1), 'text': kw.get('text', ''),
                           'values': list(kw.get('values') or []), 'tags': kw.get('tags') or []})
        return self._rows[-1]['iid']

    def delete(self, *items):
        wanted = set(str(i) for i in items)
        self._rows = [row for row in self._rows if row['iid'] not in wanted]

    def get_children(self, *a):
        return tuple(row['iid'] for row in self._rows)

    def item(self, iid, **kw):
        for row in self._rows:
            if row['iid'] == iid:
                if kw:
                    row.update(kw)
                return dict(row)
        return {}

    def selection(self):
        return getattr(self, '_selected_rows', ())

    def selection_set(self, *items):
        self._selected_rows = tuple(str(i) for i in items)

    def tag_configure(self, name, **kw):
        self._tags[str(name)] = kw

    def see(self, item):
        return None

    def _paint_content(self, draw, x, y, w, h):
        bg = self._bg((255, 255, 255))
        self._surface(draw, x, y, w, h, bg=bg, border=True, relief='sunken', bd=1)
        font = self._font()
        row_h = _text_size('Ag', font)[1] + 6
        columns = ['#0'] + self._columns
        widths = []
        for column in columns:
            if column == '#0':
                widths.append(self._widths.get('#0', 140))
            else:
                widths.append(self._widths.get(column, 90))
        total = sum(widths) or 1
        scale = max(1.0, 0.0) if total <= w else w / float(total)
        widths = [max(24, int(part * (w / float(total)))) for part in widths]
        cx = x + 1
        for column, width in zip(columns, widths):
            label = self._headings.get(column, {}).get('text', '#' if column == '#0' else column)
            draw.rectangle([cx, y + 1, cx + width, y + row_h], fill=(238, 238, 238))
            _draw_text(draw, cx + 5, y + 1 + row_h // 2, label, font, (40, 40, 40), W)
            cx += width
        cy = y + row_h + 1
        for index, row in enumerate(self._rows):
            if cy + row_h > y + h:
                break
            fill = None
            for tag in row['tags']:
                colour = self._tags.get(str(tag), {}).get('background')
                if colour:
                    fill = _rgb(colour)
            if fill:
                draw.rectangle([x + 1, cy, x + w - 1, cy + row_h], fill=fill)
            elif index % 2:
                draw.rectangle([x + 1, cy, x + w - 1, cy + row_h], fill=(247, 247, 247))
            cx = x + 1
            cells = [row['text']] + [str(v) for v in row['values']]
            for cell, width in zip(cells, widths):
                _draw_text(draw, cx + 5, cy + row_h // 2, cell, font, (30, 30, 30), W)
                cx += width
            cy += row_h

    def _request(self):
        return (300, 140)


class Panedwindow(_PanedWindow):
    _fill_default = BG


# -- the names Tk has with another spelling
Labelframe = LabelFrame
