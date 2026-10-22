# Run from the repo root:  python3 scripts/image-tooling/build_images.py  (needs pillow, numpy)
import sys, os; sys.path.insert(0, os.path.dirname(__file__))
import json, os, re
import numpy as np
from PIL import Image, ImageFilter
from crop import spec, B
OUT="public/products"
UNUSED="data/unassigned-board-images"
SIZE=800

def clean(im, k, i):
    a=np.array(im).astype(int)
    h,w,_=a.shape
    # inset to drop card border on left/right/top
    a=a[4:, 6:w-6]; h,w,_=a.shape
    # light-lime border pixels -> white
    r,g,bb=a[...,0],a[...,1],a[...,2]
    a[(g>r+6)&(g>bb+14)&(r>150)&(g>210)&(bb>110)]=255
    # remove lime number badge in top-left
    reg=a[:75,:75]
    r,g,bl=reg[...,0],reg[...,1],reg[...,2]
    lime=(r>150)&(g>200)&(bl<140)
    if lime.sum()>150:
        ys,xs=np.where(lime)
        y0,y1,x0,x1=max(ys.min()-3,0),ys.max()+4,max(xs.min()-3,0),xs.max()+4
        a[y0:y1,x0:x1]=255
    # whiten near-white tinted background
    mn=a.min(axis=2)
    a[mn>236]=255
    return a.astype(np.uint8)

def tight_square(a, pad=0.06):
    mask=(a.min(axis=2)<244)
    ys,xs=np.where(mask)
    if len(ys)==0: return Image.fromarray(a)
    y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
    c=Image.fromarray(a[y0:y1,x0:x1])
    w,h=c.size; side=int(max(w,h)*(1+2*pad))
    sq=Image.new("RGB",(side,side),"white"); sq.paste(c,((side-w)//2,(side-h)//2))
    sq=sq.resize((SIZE,SIZE),Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.2,percent=60,threshold=2))
    return sq

# (board, index1) -> (sku, board label, confidence)
M={}
def add(board,idx,sku,label,conf="exact"): M[(board,idx)]=(sku,label,conf)
fas=["Classic Everyday Backpack","Laptop Backpack (15.6-inch)","Crossbody Bag","Women's Structured Handbag","Men's Casual Belt","Unisex Baseball Cap","Polarised Sunglasses","Minimalist Wristwatch","Wallet and Card Holder Set","Travel Toiletry Bag","Packing Cubes Set","Lightweight Travel Duffel Bag","Unisex Slides","Everyday Sneakers","Cotton Crew T-Shirt","Unisex Hoodie","Lightweight Scarf","Stainless Steel Jewellery Set","Adjustable Fashion Bracelet","Travel Neck Pillow"]
bea=["Facial Cleansing Brush","Makeup Brush Set","Cosmetic Organiser","Rechargeable Facial Trimmer","Electric Hair Clipper","Hair Dryer","Heat Styling Hair Straightener","Curling Wand","Satin Bonnet and Scrunchie Set","Microfibre Hair Towel Wrap","Refillable Perfume Atomiser","Electric Nail Care Kit","Manicure and Pedicure Set","Makeup Mirror with LED Lights","Silicone Body Scrubber","Shower Cap Multipack","Skincare Travel Bottle Set","Hot Water Foot Spa Basin"]
for i,l in enumerate(fas): add("fashion",i+1,f"CC-FAS-{i+1:03d}",l)
for i,l in enumerate(bea): add("fashion",21+i,f"CC-BEA-{i+1:03d}",l)
home=["Non-Stick Frying Pan","Stainless Steel Cooking Pot Set","Food Storage Container Set","Insulated Water Bottle 1L","Electric Kettle","French Press Coffee Maker","Manual Vegetable Chopper","Knife and Cutting Board Set","Digital Food Thermometer","Silicone Cooking Utensil Set","Microwave-Safe Bowl Set","Dish Drying Rack","Bathroom Storage Shelf","Laundry Hamper","Microfibre Cleaning Cloth Pack","Cordless Handheld Vacuum","Bedside Table Lamp","Blackout Window Curtains","Decorative Cushion Cover Set","Foldable Storage Bins","Digital Bathroom Scale","Reusable Food Wrap Set","Airtight Spice Jar Set","Shower Caddy","Water Filter Pitcher"]
for i,l in enumerate(home): add("home",i+1,f"CC-HOM-{i+1:03d}",l)
ele=["Wireless Bluetooth Earbuds","Bluetooth Over-Ear Headphones","Portable Bluetooth Speaker","Smart Fitness Band","Smart Watch","USB-C Fast Charging Adapter","USB-C Charging Cable","Multi-Port USB Charging Hub","20,000mAh Power Bank","10,000mAh Power Bank","Wireless Charging Pad","Laptop Cooling Stand"]
for i,l in enumerate(ele): add("elec",i+1,f"CC-ELE-{i+1:03d}",l)
add("elec",13,"CC-ELE-016","Webcam with Microphone","similar")
add("elec",15,"CC-ELE-023","Surge Protector Extension Socket","similar")
add("office",1,"CC-ELE-013","Adjustable Laptop Stand")
add("office",3,"CC-ELE-027","Wireless Presentation Clicker","similar")
add("office",4,"CC-ELE-014","Wireless Keyboard and Mouse","similar")
add("office",6,"CC-OFF-012","Portable Document Scanner")
add("office",7,"CC-OFF-007","Whiteboard with Markers","similar")
add("office",8,"CC-OFF-009","Scientific Calculator")
add("office",9,"CC-ELE-026","USB Flash Drive","similar")
add("office",10,"CC-OFF-005","Laminator Machine","similar")
add("office",11,"CC-OFF-011","Desk Organiser","similar")
add("kids",6,"CC-BAB-002","Kids Backpack","similar")
add("kids",14,"CC-SPO-001","Yoga Mat")

labels={"kids":["Baby Stroller","Baby Walker","Baby Car Seat","Toys Set","Kids Tracksuit","Kids Backpack","Kids Sneakers","Girls Dress","Boys Outfit","Baby Feeding Set","Play Tent & Ball Pit","Inline Skates","Football","Yoga Mat","Dumbbell Set","Bicycle","Camping Tent","Sleeping Bag","Sports Water Bottle","Outdoor Backpack"],
"elec":["Wireless Bluetooth Earbuds","Bluetooth Over-Ear Headphones","Portable Bluetooth Speaker","Smart Fitness Band","Smart Watch","USB-C Fast Charging Adapter","USB-C Charging Cable","Multi-Port USB Charging Hub","20,000mAh Power Bank","10,000mAh Power Bank","Wireless Charging Pad","Laptop Cooling Stand","Webcam with Microphone","Monitor Stand","Surge Protector Extension Socket","Portable Document Scanner","Whiteboard with Markers","Wireless Presentation Clicker","Action Camera","Bluetooth Earphones (Neckband)","Projector","Smart TV Box","Smart Watch (Kids)","Calculator","Printer","3D Printer","Drone","Wireless Router","Smart Home Camera","Gaming Console Controller"],
"office":["Adjustable Laptop Stand","Ergonomic Office Chair","Wireless Presentation Clicker","Wireless Keyboard and Mouse","Wireless Printer","Portable Document Scanner","Whiteboard with Markers","Scientific Calculator","USB Flash Drive","Laminator Machine","Desk Organiser","A4 Paper (500 Sheets)"]}
os.makedirs(OUT,exist_ok=True); os.makedirs(UNUSED,exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT,f))   # remove old generated illustrations
manifest=[]; unused=[]
for k,boxes in spec.items():
    im=Image.open(B[k]).convert("RGB")
    for i,b in enumerate(boxes,1):
        a=clean(im.crop(b),k,i); sq=tight_square(a)
        if (k,i) in M:
            sku,label,conf=M[(k,i)]
            sq.save(f"{OUT}/{sku}.webp","WEBP",quality=88,method=6)
            manifest.append(dict(sku=sku,file=f"/products/{sku}.webp",board=k,boardIndex=i,boardLabel=label,match=conf))
        else:
            lbl=labels.get(k,[None]*99)[i-1] if k in labels else None
            fn=f"{k}-{i:02d}.webp"; sq.save(f"{UNUSED}/{fn}","WEBP",quality=85)
            unused.append(dict(file=fn,board=k,boardIndex=i,boardLabel=lbl,reason="no catalogue product with this name"))
json.dump(manifest,open("data/image-manifest.json","w"),indent=1)
json.dump(unused,open(f"{UNUSED}/manifest.json","w"),indent=1)
print(len(manifest),"matched;",len(unused),"unassigned")
