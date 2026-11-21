"""Pictures made inside the sandbox, collected for the page after the run.

Anything that draws without a screen (the pygame and turtle shims, a plot saved by hand) adds its PNG here as base64.
The interpreter reads FIGURES once the program has finished and shows them under the output, so a program that only
draws something is never silent.
"""

FIGURES = []
KEEP = 8
TITLES = []


def add(png_base64, title=""):
    """Remember one picture. The last few are kept so a long animation does not fill memory."""
    FIGURES.append(png_base64)
    TITLES.append(title or "frame %d" % len(FIGURES))
    while len(FIGURES) > KEEP:
        FIGURES.pop(0)
        TITLES.pop(0)
    return png_base64


def last():
    return FIGURES[-1] if FIGURES else None


def clear():
    FIGURES.clear()
    TITLES.clear()
