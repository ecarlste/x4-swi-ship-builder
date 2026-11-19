-- Throwaway test mod for "Run the preset-export test mod in game" (ecarlste/x4-swi-ship-builder#17).
-- Generates the ship configuration menu's Minimum/Low/Medium/High presets with no station
-- (containerid 0, the custom game start path) for every ship macro, twice, and logs them.
-- Pass 1 is also saved to the profile's loadouts.xml as swipreset_<level>_<macro>.
local ffi = require("ffi")
local C = ffi.C

-- The UILoadout2 types and the five engine function declarations are copied at install time from SWI's own
-- ui/addons/ego_detailmonitor/menu_ship_configuration.xpl (not kept in this repo).
-- Each is declared in its own pcall: if the menu already declared it in this Lua state, the
-- redefinition error is harmless.
local decls = {
  "typedef uint64_t UniverseID;",
  --@@SWI_DECLS@@ install.mjs fills this in from your own SWI install
}
for _, d in ipairs(decls) do
  local ok, err = pcall(ffi.cdef, d)
  if not ok then DebugError("SWIPRESET;CDEF-SKIP;" .. tostring(err)) end
end

local levels = { { "minimum", 0 }, { "low", 0.1 }, { "medium", 0.5 }, { "high", 1.0 } }

local function str(p) return (p ~= nil) and ffi.string(p) or "" end

local function slots(lo, cat)
  local out = {}
  for i = 0, lo["num" .. cat] - 1 do
    local e = lo[cat][i]
    out[#out + 1] = tostring(tonumber(e.slot)) .. "=" .. str(e.macro)
  end
  return cat .. "[" .. table.concat(out, ",") .. "]"
end

local function groups(lo, cat)
  local out = {}
  for i = 0, lo["num" .. cat] - 1 do
    local e = lo[cat][i]
    out[#out + 1] = str(e.group) .. "x" .. tostring(e.count) .. "=" .. str(e.macro)
  end
  return cat .. "[" .. table.concat(out, ",") .. "]"
end

local function amounts(lo, cat)
  local out = {}
  for i = 0, lo["num" .. cat] - 1 do
    local e = lo[cat][i]
    out[#out + 1] = str(e.macro) .. "x" .. tostring(e.amount)
  end
  return cat .. "[" .. table.concat(out, ",") .. "]"
end

local function software(lo)
  local out = {}
  for i = 0, lo.numsoftware - 1 do out[#out + 1] = str(lo.software[i].ware) end
  return "software[" .. table.concat(out, ",") .. "]"
end

local function describe(lo)
  return table.concat({
    slots(lo, "engines"), "thruster[" .. str(lo.thruster.macro) .. "]", slots(lo, "shields"),
    slots(lo, "weapons"), slots(lo, "turrets"), groups(lo, "shieldgroups"), groups(lo, "turretgroups"),
    amounts(lo, "ammo"), amounts(lo, "units"), software(lo),
  }, ";")
end

local function run()
  local n = C.GetNumAllShipMacros2(false, false)
  local buf = ffi.new("const char*[?]", n)
  n = C.GetAllShipMacros2(buf, n, false, false)
  local macros = {}
  for i = 0, n - 1 do macros[#macros + 1] = ffi.string(buf[i]) end
  DebugError("SWIPRESET;BEGIN;" .. n)
  for pass = 1, 2 do
    for _, macro in ipairs(macros) do
      for _, lv in ipairs(levels) do
        local ok, err = pcall(function ()
          local lo = Helper.getLoadoutHelper2(C.GenerateShipLoadout2, C.GenerateShipLoadoutCounts2, "UILoadout2", 0, 0, macro, lv[2])
          DebugError("SWIPRESET;P" .. pass .. ";" .. macro .. ";" .. lv[1] .. ";" .. describe(lo))
          if pass == 1 then
            C.SaveLoadout2(macro, lo, "local", "swipreset_" .. lv[1] .. "_" .. macro, true, "swipreset " .. lv[1], "")
          end
        end)
        if not ok then DebugError("SWIPRESET;ERROR;P" .. pass .. ";" .. macro .. ";" .. lv[1] .. ";" .. tostring(err)) end
      end
    end
  end
  DebugError("SWIPRESET;END")
end

RegisterEvent("swiPresetExport", run)
