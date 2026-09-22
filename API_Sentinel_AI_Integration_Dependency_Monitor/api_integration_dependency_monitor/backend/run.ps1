Set-Location $PSScriptRoot
if (!(Test-Path '.venv')) {
  py -3.12 -m venv .venv
}
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
