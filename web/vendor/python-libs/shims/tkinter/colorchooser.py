"""The colour picker, without a window: it answers the default colour (or "no colour chosen" when asked for one)."""


def askcolor(color=None, **kw):
    print('--- colour chooser --- no window here; using %s' % (color or 'black'))
    from . import _rgb
    rgb = _rgb(color, 'black')
    return (rgb, '#%02x%02x%02x' % rgb)
