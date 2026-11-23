"""Message dialogs, without a window.

Nothing can be clicked here, so each dialog prints what it would have said (so the message is never lost) and answers
as if Cancel or OK was pressed. `askyesno` answers True and `askquestion` answers 'yes', so the happy path of a program
runs on; the value is printed too.
"""


def _say(kind, title, message, default=None):
    text = str(message)
    header = ('[%s] ' % title) if title else ''
    print(('--- %s --- ' % kind) + header + text)
    return default


def showinfo(title=None, message=None, **kw):
    return _say('information', title, message, 'ok')


def showwarning(title=None, message=None, **kw):
    return _say('warning', title, message, 'ok')


def showerror(title=None, message=None, **kw):
    return _say('error', title, message, 'ok')


def askquestion(title=None, message=None, **kw):
    _say('question', title, message, 'yes')
    return 'yes'


def askyesno(title=None, message=None, **kw):
    _say('question', title, message, True)
    return True


def askokcancel(title=None, message=None, **kw):
    _say('question', title, message, True)
    return True


def askretrycancel(title=None, message=None, **kw):
    _say('question', title, message, False)
    return False


def askyesnocancel(title=None, message=None, **kw):
    _say('question', title, message, None)
    return None


def askstring(title=None, prompt=None, **kw):
    _say('text', title, prompt, None)
    return None


def askinteger(title=None, prompt=None, **kw):
    _say('number', title, prompt, None)
    return None


def askfloat(title=None, prompt=None, **kw):
    _say('number', title, prompt, None)
    return None
