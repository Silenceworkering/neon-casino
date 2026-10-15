"""Emit the initial PostgreSQL migration from this project's scalar Prisma schema.
Review generated SQL before changing schema; later migrations use Prisma Migrate.
"""
import re,pathlib
schema=pathlib.Path('prisma/schema.prisma').read_text()
models=re.findall(r'model (\w+) \{(.*?)\n\}',schema,re.S)
types={'String':'TEXT','Int':'INTEGER','Boolean':'BOOLEAN','DateTime':'TIMESTAMP(3)','Json':'JSONB'}
statements=[];constraints=[];indexes=[]
for name,body in models:
 cols=[];primary=[]
 for line in body.splitlines():
  line=line.strip()
  if not line:continue
  if line.startswith('@@'):
   m=re.match(r'@@(id|unique|index)\(\[([^]]+)\]\)',line)
   if m:
    kind,fs=m.groups();fields=[f.strip() for f in fs.split(',')];quoted=', '.join('"'+f+'"' for f in fields)
    if kind=='id':primary=fields
    else:indexes.append(f'CREATE {"UNIQUE " if kind=="unique" else ""}INDEX "{name}_{"_".join(fields)}_{"key" if kind=="unique" else "idx"}" ON "{name}" ({quoted});')
   continue
  f,t,*_=line.split();base=t.rstrip('?[]')
  if base not in types:
   m=re.search(r'@relation\(fields:\[([^]]+)\],references:\[([^]]+)\](?:,onDelete:(\w+))?\)',line.replace(' ',''))
   if m:
    fs,refs,delete=m.groups();constraints.append(f'ALTER TABLE "{name}" ADD CONSTRAINT "{name}_{fs}_fkey" FOREIGN KEY ("{fs}") REFERENCES "{base}"("{refs}") ON DELETE {"CASCADE" if delete=="Cascade" else "RESTRICT"} ON UPDATE CASCADE;')
   continue
  col=f'"{f}" {types[base]}'
  if not t.endswith('?'):col+=' NOT NULL'
  if '@id' in line:primary=[f]
  if '@unique' in line:indexes.append(f'CREATE UNIQUE INDEX "{name}_{f}_key" ON "{name}" ("{f}");')
  default=re.search(r'@default\((now\(\)|uuid\(\)|"(?:[^"\\]|\\.)*"|[^)]+)\)',line)
  if default:
   v=default[1]
   if v=='now()':col+=' DEFAULT CURRENT_TIMESTAMP'
   elif v!='uuid()':
    if v.startswith('"'):v="'"+v[1:-1].replace("'","''").replace('\\"','"')+"'"
    col+=' DEFAULT '+v
  cols.append(col)
 if primary:cols.append(f'CONSTRAINT "{name}_pkey" PRIMARY KEY ('+', '.join('"'+f+'"' for f in primary)+')')
 statements.append(f'CREATE TABLE "{name}" (\n  '+',\n  '.join(cols)+'\n);')
sql='-- Initial persistent schema. All money operations additionally use serializable transactions.\n\n'+'\n\n'.join(statements+indexes+constraints)+'''\n\nALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_nonnegative" CHECK (coins >= 0 AND crystals >= 0);
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_bet_nonnegative" CHECK (bet >= 0);
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_uses_limit" CHECK (uses >= 0 AND uses <= "limit");
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_distinct" CHECK ("senderId" <> "receiverId");
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_sender_fkey" FOREIGN KEY ("senderId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_receiver_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "GameRoom" ADD CONSTRAINT "GameRoom_owner_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referred_fkey" FOREIGN KEY ("referredId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_inviter_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_distinct" CHECK ("referredId" <> "inviterId");
'''
p=pathlib.Path('prisma/migrations/20261015000000_initial/migration.sql');p.parent.mkdir(parents=True,exist_ok=True);p.write_text(sql)
