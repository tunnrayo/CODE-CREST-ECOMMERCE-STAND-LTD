import json, sys
from PIL import Image, ImageDraw
U="data/source/image-boards/"
B={"kids":U+"board-baby-kids-sports-outdoor-20.png","fashion":U+"board-fashion-beauty-38.png","elec":U+"board-electronics-gadgets-30.png","home":U+"board-home-kitchen-25.png","office":U+"board-office-study-12.png"}
def grid(xs,ys):
    return [(x0,y0,x1,y1) for (y0,y1) in ys for (x0,x1) in xs]
cx5=[(15,205),(218,408),(418,608),(620,808),(820,1010)]
spec={
 "kids":grid(cx5,[(172,368),(482,664),(776,958),(1068,1248)]),
 "elec":grid([(22,258),(275,510),(527,762),(778,1012),(1030,1265),(1280,1514)],[(122,226),(296,403),(472,579),(648,746),(815,896)]),
 "home":grid(cx5,[(207,390),(457,630),(698,878),(942,1112),(1184,1350)]),
 "office":grid([(15,255),(268,508),(520,758),(770,1010)],[(180,410),(550,770),(902,1115)]),
 "fashion":(
   grid([(15,173),(185,343),(352,510),(520,677),(688,845),(855,1010)],[(150,291),(345,472),(527,656)])
   +[(15,710,173,840),(185,710,343,840)]
   +[(362,740,560,856),(580,740,785,856),(797,740,1005,856)]
   +[(15,897,178,1028),(187,897,348,1028)]
   +[(362,905,562,1031),(580,905,788,1032),(797,905,1005,1030)]
   +[(15,1080,225,1204),(238,1080,427,1204),(440,1080,620,1204),(632,1080,818,1204),(830,1080,1005,1204)]
   +[(15,1258,220,1380),(240,1258,428,1380),(440,1258,622,1380),(632,1258,818,1380),(830,1258,1005,1380)]),
}
if __name__=="__main__":
    for k,boxes in spec.items():
        im=Image.open(B[k]).convert("RGB")
        cols=6; cell=230
        rows=(len(boxes)+cols-1)//cols
        sheet=Image.new("RGB",(cols*cell,rows*(cell+22)),"white"); d=ImageDraw.Draw(sheet)
        for i,b in enumerate(boxes):
            c=im.crop(b); c.thumbnail((cell-6,cell-6))
            x=(i%cols)*cell; y=(i//cols)*(cell+22)
            sheet.paste(c,(x+3,y+22)); d.text((x+4,y+4),f"{k} #{i+1}",fill="red")
        sheet.save(f"/tmp/sheet_{k}.png"); print(k,len(boxes))
