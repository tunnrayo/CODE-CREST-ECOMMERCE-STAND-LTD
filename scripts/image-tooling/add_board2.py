# Adds the 37 products from board-remaining-37-products.png (cells are labelled with SKUs). Run from the repo root.
# Unlike build_images.py this is additive: it keeps existing files and appends to data/image-manifest.json.
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
SIZE=800
src=open(os.path.join(os.path.dirname(__file__),"build_images.py")).read()
exec(src[src.index("def clean"):src.index("# (board, index1)")])   # reuse clean() and tight_square()
BOARD="data/source/image-boards/board-remaining-37-products.png"
def row(xs,y0,y1): return [(a,y0,b,y1) for a,b in xs]
E1=[(22,218),(232,420),(432,620),(634,822),(836,1024),(1036,1226)]
O=[(22,195),(205,373),(383,545),(555,722),(731,875),(885,1050),(1060,1230)]
K=[(22,155),(165,315),(325,470),(482,630),(640,740),(748,858),(866,976),(986,1104),(1112,1230)]
S=[(22,158),(168,312),(320,436),(446,602),(612,720),(730,845),(855,973),(983,1100),(1110,1230)]
boxes=row(E1,106,226)+row(E1,282,392)+row(O,537,668)+row(K,805,918)+row(S,1052,1160)
# the board prints "CC-SPO-008" under "Kids' Lunch Box Set"; the catalogue SKU for that product is CC-BAB-008
SKUS=["CC-ELE-015","CC-ELE-017","CC-ELE-018","CC-ELE-019","CC-ELE-020","CC-ELE-021","CC-ELE-022","CC-ELE-024","CC-ELE-025","CC-ELE-028","CC-ELE-029","CC-ELE-030",
 "CC-OFF-001","CC-OFF-002","CC-OFF-003","CC-OFF-004","CC-OFF-006","CC-OFF-008","CC-OFF-010",
 "CC-BAB-001","CC-BAB-003","CC-BAB-004","CC-BAB-005","CC-BAB-006","CC-BAB-007","CC-BAB-008","CC-BAB-009","CC-BAB-010",
 "CC-SPO-002","CC-SPO-003","CC-SPO-004","CC-SPO-005","CC-SPO-006","CC-SPO-007","CC-SPO-008","CC-SPO-009","CC-SPO-010"]
LABELS=["USB-C Multiport Adapter","Ring Light with Phone Holder","Tripod Phone Stand","Car Phone Mount","Digital Kitchen Scale","Rechargeable Desk Fan","Mini UPS for Router","HDMI Cable 2m","Portable SSD 500GB","Digital Alarm Clock","Smart Plug","LED Monitor Light Bar",
 "A4 Document Organiser","Desktop File Holder","Ergonomic Office Chair Cushion","Adjustable Footrest","Paper Shredder","Whiteboard Marker Set","A4 Notebook Multipack",
 "Insulated Kids Water Bottle","Building Blocks Set","Educational Flash Cards","Children's Art Supply Set","Kids' Drawing Tablet","Soft Plush Toy","Kids' Lunch Box Set","Baby Changing Bag","Baby Bath Thermometer",
 "Resistance Bands Set","Adjustable Skipping Rope","Stainless Steel Sports Bottle","Insulated Picnic Cooler Bag","Camping LED Lantern","Compact Travel First Aid Kit","Foldable Outdoor Chair","Football Training Cones Set","Fitness Hand Grip Trainer"]
assert len(boxes)==len(SKUS)==len(LABELS)==37
im=Image.open(BOARD).convert("RGB")
if "--sheet" in sys.argv:
    cell=200; cols=8; rows=(37+cols-1)//cols
    sh=Image.new("RGB",(cols*cell,rows*(cell+16)),"white"); d=ImageDraw.Draw(sh)
    for i,b in enumerate(boxes):
        c=im.crop(b); c.thumbnail((cell-4,cell-4)); x=(i%cols)*cell; y=(i//cols)*(cell+16); sh.paste(c,(x+2,y+16)); d.text((x+3,y+2),SKUS[i],fill="red")
    sh.save("/tmp/sheet_board2.png"); sys.exit()
man=json.load(open("data/image-manifest.json")); have={m["sku"] for m in man}
for i,b in enumerate(boxes):
    sku=SKUS[i]
    sq=tight_square(clean(im.crop(b),"b2",i+1))
    sq.save(f"public/products/{sku}.webp","WEBP",quality=88,method=6)
    if sku not in have: man.append(dict(sku=sku,file=f"/products/{sku}.webp",board="remaining-37",boardIndex=i+1,boardLabel=LABELS[i],match="exact"))
json.dump(man,open("data/image-manifest.json","w"),indent=1); print(len(man),"images in manifest")
