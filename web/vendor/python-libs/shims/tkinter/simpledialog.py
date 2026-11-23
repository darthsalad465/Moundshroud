"""Simple input dialogs, without a window: there is no keyboard, so each one answers "cancelled" (None)."""


def _cancel(title=None, prompt=None, initialvalue=None, **kw):
    print('--- input dialog --- %s%s' % (('%s: ' % title) if title else '', prompt or ''))
    return None


class Dialog:
    def __init__(self, parent=None, title=None, **kw):
        self.parent = parent
        self.title = title
        self.result = None

    def go(self, *a, **k):
        return None

    def destroy(self):
        return None

    def body(self, master):
        return None

    def validate(self):
        return 1

    def apply(self):
        return None


def askstring(title=None, prompt=None, **kw):
    return _cancel(title, prompt)


def askinteger(title=None, prompt=None, **kw):
    return _cancel(title, prompt)


def askfloat(title=None, prompt=None, **kw):
    return _cancel(title, prompt)
