# Reorders the slides of a .pptx to the given order (python-pptx). usage: python pptx_order.py file.pptx "[2,0,1,...]"
# The list says, for each slide of the final deck, which current slide (0-based) it is.
import sys, json
from pptx import Presentation

path, order = sys.argv[1], json.loads(sys.argv[2])
prs = Presentation(path)
lst = prs.slides._sldIdLst
items = list(lst)
if sorted(order) != list(range(len(items))):
    raise SystemExit("order does not match the slide count")
for el in items:
    lst.remove(el)
for i in order:
    lst.append(items[i])
prs.save(path)
