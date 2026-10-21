# Side-by-side: design mockup (left) | app (right), at 393x852. Output tests/screenshots/design/vs-*.png
import sys, os
from PIL import Image
D='tests/screenshots/design/'; F='tests/screenshots/fit/393x852-'
PAIRS={'enter-team':'enter.png','enter-individual':'design-solo.png','matches':'design-watching.png','card-player':'design-player.png','board':'board.png','card':'card.png',
 'setup-1-course':'setup-1-find-a-course-.png','setup-2-players':'setup-2-players-.png','setup-3-game':'setup-3-pick-a-game-.png',
 'setup-4-2v2':'setup-4-2v2-partners-.png','setup-4-carts':'setup-4-carts-.png','setup-4b-matchups':'setup-4b-matchups-.png',
 'setup-5-live':'setup-5-round-is-live-.png','scorecard-check':'setup-scorecard-check.png'}
extra=dict(a.split('=') for a in sys.argv[1:])
for k,v in {**PAIRS,**extra}.items():
  if not v: continue
  app=v if os.path.exists(v) else F+v
  if not os.path.exists(app): continue
  a=Image.open(D+'mock-'+k+'.png'); b=Image.open(app)
  b=b.resize((a.width, int(b.height*a.width/b.width)))
  out=Image.new('RGB',(a.width*2+20,max(a.height,b.height)),(60,60,60)); out.paste(a,(0,0)); out.paste(b,(a.width+20,0))
  out=out.resize((out.width//2,out.height//2)); out.save(D+'vs-'+k+'.png')
