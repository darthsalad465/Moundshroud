"""File dialogs, without a window: there is no way to pick a file here, so every dialog answers "cancelled"."""


def _cancel(title=None, **kw):
    return ''


def askopenfilename(**kw):
    return ''


def askopenfilenames(**kw):
    return ()


def asksaveasfilename(**kw):
    return ''


def askdirectory(**kw):
    return ''


def askopenfile(mode='r', **kw):
    return None


def askopenfiles(mode='r', **kw):
    return None


def asksaveasfile(mode='w', **kw):
    return None
