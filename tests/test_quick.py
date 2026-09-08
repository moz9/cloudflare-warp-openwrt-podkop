import re, subprocess, tempfile, unittest, os
from pathlib import Path
SOURCE=(Path(__file__).resolve().parents[1]/"root/usr/libexec/warp-autotune").read_text(encoding="utf-8")
SHELL=r"C:/Program Files/Git/bin/bash.exe" if os.name=="nt" else "sh"
def function(name):
 m=re.search(r"("+name+r"\(\) \{.*?\n\})",SOURCE,re.S)
 assert m, name+" missing"
 return m.group(1)
class QuickTests(unittest.TestCase):
 def test_stats_mean_median_range(self):
  with tempfile.TemporaryDirectory() as d:
   Path(d,"values").write_text("100\n300\n200\n")
   p=subprocess.run([SHELL,"-c",function("speed_stats")+"\nspeed_stats values"],cwd=d,text=True,capture_output=True,check=True)
   self.assertEqual(p.stdout.strip(),"200|200|100|300|3")
 def test_balanced_schedule(self):
  with tempfile.TemporaryDirectory() as d:
   Path(d,"finalists").write_text("1|a|6\n4|b|12\n")
   p=subprocess.run([SHELL,"-c",function("quick_schedule")+"\nWORK=.; quick_schedule"],cwd=d,text=True,capture_output=True,check=True)
   self.assertEqual([x.split("|")[0] for x in p.stdout.splitlines()],["1","4","4","1","1","4"])
 def test_assessment_requires_nonoverlapping_margin(self):
  for a,b,expected in [("100\\n110\\n105\\n","100\\n102\\n101\\n","close"),("200\\n210\\n205\\n","100\\n102\\n101\\n","advantage")]:
   with tempfile.TemporaryDirectory() as d:
    for ident,values in [(1,a),(2,b)]:
     for direction in ["speeds","uploads"]: Path(d,f"{direction}-{ident}").write_text(values.replace("\\n","\n"))
    Path(d,"ranked").write_text("1|ep|6|3|3|0|0|1|200|3|0|3|200|3|3\n2|ep|6|3|3|0|0|1|100|3|0|3|100|3|3\n")
    script=function("speed_stats")+"\n"+function("assess_results")+"\nWORK=.; get() { echo finalists; }; put() { echo $2 > result; }; assess_results; cat result"
    p=subprocess.run([SHELL,"-c",script],cwd=d,text=True,capture_output=True,check=True)
    self.assertEqual(p.stdout.strip(),expected)
 def test_five_minutes_allowed(self):
  self.assertIn("5|15|30|45|60",SOURCE)
if __name__=="__main__": unittest.main()
