#!/usr/bin/env python3
"""Generates RoomScanInspector.xcodeproj (project.pbxproj + shared scheme).

Run from the repository root after adding/removing source files:
    python3 tools/generate_xcodeproj.py

Equivalent XcodeGen spec: project.yml (`xcodegen generate`). Either works;
the committed .xcodeproj comes from this script so no extra tool is needed.
"""
import hashlib
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = "RoomScanInspector"
TESTS = "RoomScanInspectorTests"
BUNDLE_ID = "com.example.roomscaninspector"
DEPLOYMENT = "17.0"


def uid(*parts):
    return hashlib.md5("/".join(parts).encode()).hexdigest()[:24].upper()


def q(s):
    """Quote a pbxproj string when needed."""
    if s and all(c.isalnum() or c in "._/$" for c in s) and not s[0].isdigit():
        return s
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def files_under(rel, exts):
    out = []
    for dirpath, _, names in os.walk(os.path.join(ROOT, rel)):
        for n in sorted(names):
            if os.path.splitext(n)[1] in exts:
                out.append(os.path.relpath(os.path.join(dirpath, n), ROOT))
    return sorted(out)


app_sources = files_under("App/Sources", {".swift"})
test_sources = files_under("AppTests", {".swift"})

objects = {}


def add(oid, isa, **props):
    objects[oid] = (isa, props)
    return oid


FILETYPE = {".swift": "sourcecode.swift", ".plist": "text.plist.xml", ".xcassets": "folder.assetcatalog",
            ".strings": "text.plist.strings", ".md": "net.daringfireball.markdown"}

# ---------- file references ----------
def file_ref(path, name=None):
    ext = os.path.splitext(path)[1]
    return add(uid("ref", path), "PBXFileReference", lastKnownFileType=FILETYPE.get(ext, "text"),
               path=os.path.basename(path) if name is None else path, sourceTree="<group>",
               **({"name": name} if name else {}))

# Build group tree from paths relative to a group root.
def build_group(name, root_rel, paths, extra_children=()):
    tree = {}
    for p in paths:
        parts = os.path.relpath(p, root_rel).split(os.sep)
        node = tree
        for d in parts[:-1]:
            node = node.setdefault(d + "/", {})
        node[parts[-1]] = p

    def make(label, node, rel):
        children = []
        for k in sorted(node, key=lambda s: (not s.endswith("/"), s)):
            v = node[k]
            if k.endswith("/"):
                children.append(make(k[:-1], v, os.path.join(rel, k[:-1])))
            else:
                children.append(file_ref(v))
        return add(uid("group", rel), "PBXGroup", children=children, path=label, sourceTree="<group>")

    gid = make(name, tree, root_rel)
    objects[gid][1]["children"] = objects[gid][1]["children"] + list(extra_children)
    return gid

# Resources
info_plist = file_ref("App/Resources/Info.plist")
assets = file_ref("App/Resources/Assets.xcassets")
variant = {}
for table in ("Localizable.strings", "InfoPlist.strings"):
    kids = [add(uid("ref", lang, table), "PBXFileReference", lastKnownFileType="text.plist.strings",
                name=lang, path=f"{lang}.lproj/{table}", sourceTree="<group>") for lang in ("en", "ar")]
    variant[table] = add(uid("variant", table), "PBXVariantGroup", children=kids, name=table, sourceTree="<group>")
resources_group = add(uid("group", "App/Resources"), "PBXGroup",
                      children=[info_plist, assets, variant["Localizable.strings"], variant["InfoPlist.strings"]],
                      path="Resources", sourceTree="<group>")

sources_group = build_group("Sources", "App/Sources", app_sources)
app_group = add(uid("group", "App"), "PBXGroup", children=[sources_group, resources_group], path="App", sourceTree="<group>")
tests_group = build_group("AppTests", "AppTests", test_sources)
package_ref_file = add(uid("ref", "Packages/InspectionCore"), "PBXFileReference", lastKnownFileType="wrapper",
                       name="InspectionCore", path="Packages/InspectionCore", sourceTree="<group>")
readme = add(uid("ref", "README.md"), "PBXFileReference", lastKnownFileType="net.daringfireball.markdown",
             path="README.md", sourceTree="<group>")
app_product = add(uid("product", APP), "PBXFileReference", explicitFileType="wrapper.application",
                  includeInIndex="0", path=f"{APP}.app", sourceTree="BUILT_PRODUCTS_DIR")
test_product = add(uid("product", TESTS), "PBXFileReference", explicitFileType="wrapper.cfbundle",
                   includeInIndex="0", path=f"{TESTS}.xctest", sourceTree="BUILT_PRODUCTS_DIR")
products_group = add(uid("group", "Products"), "PBXGroup", children=[app_product, test_product], name="Products", sourceTree="<group>")
frameworks_group = add(uid("group", "Frameworks"), "PBXGroup", children=[], name="Frameworks", sourceTree="<group>")
main_group = add(uid("group", "main"), "PBXGroup",
                 children=[readme, package_ref_file, app_group, tests_group, products_group, frameworks_group], sourceTree="<group>")

# ---------- package ----------
pkg_ref = add(uid("pkgref", "InspectionCore"), "XCLocalSwiftPackageReference", relativePath="Packages/InspectionCore")
app_pkg_dep = add(uid("pkgdep", APP), "XCSwiftPackageProductDependency", package=pkg_ref, productName="InspectionCore")
test_pkg_dep = add(uid("pkgdep", TESTS), "XCSwiftPackageProductDependency", package=pkg_ref, productName="InspectionCore")

# ---------- build phases ----------
def build_file(target, ref, **extra):
    return add(uid("bf", target, ref), "PBXBuildFile", fileRef=ref, **extra)

app_src_phase = add(uid("phase", APP, "sources"), "PBXSourcesBuildPhase", buildActionMask="2147483647",
                    files=[build_file(APP, uid("ref", p)) for p in app_sources], runOnlyForDeploymentPostprocessing="0")
app_res_phase = add(uid("phase", APP, "resources"), "PBXResourcesBuildPhase", buildActionMask="2147483647",
                    files=[build_file(APP, assets), build_file(APP, variant["Localizable.strings"]), build_file(APP, variant["InfoPlist.strings"])],
                    runOnlyForDeploymentPostprocessing="0")
app_fw_phase = add(uid("phase", APP, "frameworks"), "PBXFrameworksBuildPhase", buildActionMask="2147483647",
                   files=[add(uid("bf", APP, "pkg"), "PBXBuildFile", productRef=app_pkg_dep)], runOnlyForDeploymentPostprocessing="0")
test_src_phase = add(uid("phase", TESTS, "sources"), "PBXSourcesBuildPhase", buildActionMask="2147483647",
                     files=[build_file(TESTS, uid("ref", p)) for p in test_sources], runOnlyForDeploymentPostprocessing="0")
test_fw_phase = add(uid("phase", TESTS, "frameworks"), "PBXFrameworksBuildPhase", buildActionMask="2147483647",
                    files=[add(uid("bf", TESTS, "pkg"), "PBXBuildFile", productRef=test_pkg_dep)], runOnlyForDeploymentPostprocessing="0")
test_res_phase = add(uid("phase", TESTS, "resources"), "PBXResourcesBuildPhase", buildActionMask="2147483647",
                     files=[], runOnlyForDeploymentPostprocessing="0")

# ---------- build settings ----------
common = {
    "ALWAYS_SEARCH_USER_PATHS": "NO", "CLANG_ENABLE_MODULES": "YES", "CLANG_ENABLE_OBJC_ARC": "YES",
    "ENABLE_STRICT_OBJC_MSGSEND": "YES", "GCC_NO_COMMON_BLOCKS": "YES", "IPHONEOS_DEPLOYMENT_TARGET": DEPLOYMENT,
    "SDKROOT": "iphoneos", "SWIFT_VERSION": "5.0", "LOCALIZATION_PREFERS_STRING_CATALOGS": "NO",
    "ENABLE_USER_SCRIPT_SANDBOXING": "YES",
}
debug = dict(common, **{"DEBUG_INFORMATION_FORMAT": "dwarf", "ONLY_ACTIVE_ARCH": "YES", "ENABLE_TESTABILITY": "YES",
                        "GCC_OPTIMIZATION_LEVEL": "0", "SWIFT_OPTIMIZATION_LEVEL": "-Onone",
                        "SWIFT_ACTIVE_COMPILATION_CONDITIONS": "DEBUG $(inherited)", "MTL_ENABLE_DEBUG_INFO": "INCLUDE_SOURCE"})
release = dict(common, **{"DEBUG_INFORMATION_FORMAT": "dwarf-with-dsym", "SWIFT_COMPILATION_MODE": "wholemodule",
                          "SWIFT_OPTIMIZATION_LEVEL": "-O", "VALIDATE_PRODUCT": "YES", "ENABLE_NS_ASSERTIONS": "NO"})
app_settings = {
    "PRODUCT_NAME": "$(TARGET_NAME)", "PRODUCT_BUNDLE_IDENTIFIER": BUNDLE_ID, "INFOPLIST_FILE": "App/Resources/Info.plist",
    "GENERATE_INFOPLIST_FILE": "NO", "ASSETCATALOG_COMPILER_APPICON_NAME": "AppIcon",
    "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME": "AccentColor", "CODE_SIGN_STYLE": "Automatic",
    "DEVELOPMENT_TEAM": "", "TARGETED_DEVICE_FAMILY": "1", "MARKETING_VERSION": "1.0", "CURRENT_PROJECT_VERSION": "1",
    "ENABLE_PREVIEWS": "YES", "SUPPORTED_PLATFORMS": "iphoneos iphonesimulator", "SUPPORTS_MACCATALYST": "NO",
    "LD_RUNPATH_SEARCH_PATHS": "$(inherited) @executable_path/Frameworks", "SWIFT_EMIT_LOC_STRINGS": "NO",
}
test_settings = {
    "PRODUCT_NAME": "$(TARGET_NAME)", "PRODUCT_BUNDLE_IDENTIFIER": BUNDLE_ID + ".tests", "GENERATE_INFOPLIST_FILE": "YES",
    "CODE_SIGN_STYLE": "Automatic", "DEVELOPMENT_TEAM": "", "TARGETED_DEVICE_FAMILY": "1",
    "BUNDLE_LOADER": "$(TEST_HOST)", "TEST_HOST": f"$(BUILT_PRODUCTS_DIR)/{APP}.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/{APP}",
    "LD_RUNPATH_SEARCH_PATHS": "$(inherited) @executable_path/Frameworks @loader_path/Frameworks",
    "MARKETING_VERSION": "1.0", "CURRENT_PROJECT_VERSION": "1",
}

def config_list(owner, base_debug, base_release):
    d = add(uid("cfg", owner, "Debug"), "XCBuildConfiguration", buildSettings=base_debug, name="Debug")
    r = add(uid("cfg", owner, "Release"), "XCBuildConfiguration", buildSettings=base_release, name="Release")
    return add(uid("cfglist", owner), "XCConfigurationList", buildConfigurations=[d, r],
               defaultConfigurationIsVisible="0", defaultConfigurationName="Release")

# ---------- targets ----------
app_target = uid("target", APP)
test_target = uid("target", TESTS)
proxy = add(uid("proxy", TESTS), "PBXContainerItemProxy", containerPortal=uid("project"), proxyType="1",
            remoteGlobalIDString=app_target, remoteInfo=APP)
dep = add(uid("dep", TESTS), "PBXTargetDependency", target=app_target, targetProxy=proxy)

add(app_target, "PBXNativeTarget", buildConfigurationList=config_list(APP, app_settings, app_settings),
    buildPhases=[app_src_phase, app_fw_phase, app_res_phase], buildRules=[], dependencies=[], name=APP,
    packageProductDependencies=[app_pkg_dep], productName=APP, productReference=app_product,
    productType="com.apple.product-type.application")
add(test_target, "PBXNativeTarget", buildConfigurationList=config_list(TESTS, test_settings, test_settings),
    buildPhases=[test_src_phase, test_fw_phase, test_res_phase], buildRules=[], dependencies=[dep], name=TESTS,
    packageProductDependencies=[test_pkg_dep], productName=TESTS, productReference=test_product,
    productType="com.apple.product-type.bundle.unit-test")

add(uid("project"), "PBXProject",
    attributes={"BuildIndependentTargetsInParallel": "1", "LastSwiftUpdateCheck": "1600", "LastUpgradeCheck": "1600",
                "TargetAttributes": {app_target: {"CreatedOnToolsVersion": "16.0"},
                                     test_target: {"CreatedOnToolsVersion": "16.0", "TestTargetID": app_target}}},
    buildConfigurationList=config_list("project", debug, release), compatibilityVersion="Xcode 14.0",
    developmentRegion="en", hasScannedForEncodings="0", knownRegions=["en", "ar", "Base"], mainGroup=main_group,
    packageReferences=[pkg_ref], productRefGroup=products_group, projectDirPath="", projectRoot="",
    targets=[app_target, test_target])

# ---------- serialize ----------
def ser(v, indent):
    pad = "\t" * indent
    if isinstance(v, dict):
        inner = "".join(f"{pad}\t{q(k)} = {ser(val, indent + 1)};\n" for k, val in v.items())
        return "{\n" + inner + pad + "}"
    if isinstance(v, list):
        inner = "".join(f"{pad}\t{ser(x, indent + 1)},\n" for x in v)
        return "(\n" + inner + pad + ")"
    return q(str(v))

out = ["// !$*UTF8*$!", "{", "\tarchiveVersion = 1;", "\tclasses = {", "\t};", "\tobjectVersion = 60;", "\tobjects = {"]
by_isa = {}
for oid, (isa, props) in objects.items():
    by_isa.setdefault(isa, []).append((oid, props))
for isa in sorted(by_isa):
    out.append(f"\n/* Begin {isa} section */")
    for oid, props in sorted(by_isa[isa]):
        body = {"isa": isa, **props}
        out.append(f"\t\t{oid} = {ser(body, 2)};")
    out.append(f"/* End {isa} section */")
out += ["\t};", f"\trootObject = {uid('project')};", "}", ""]

proj_dir = os.path.join(ROOT, f"{APP}.xcodeproj")
os.makedirs(os.path.join(proj_dir, "xcshareddata", "xcschemes"), exist_ok=True)
with open(os.path.join(proj_dir, "project.pbxproj"), "w") as f:
    f.write("\n".join(out))

def ref(target, name, product):
    return (f'<BuildableReference BuildableIdentifier = "primary" BlueprintIdentifier = "{target}" '
            f'BuildableName = "{product}" BlueprintName = "{name}" ReferencedContainer = "container:{APP}.xcodeproj">'
            f'</BuildableReference>')

scheme = f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion = "1600" version = "1.7">
   <BuildAction parallelizeBuildables = "YES" buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry buildForTesting = "YES" buildForRunning = "YES" buildForProfiling = "YES" buildForArchiving = "YES" buildForAnalyzing = "YES">
            {ref(app_target, APP, APP + ".app")}
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction buildConfiguration = "Debug" selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv = "YES">
      <Testables>
         <TestableReference skipped = "NO">
            {ref(test_target, TESTS, TESTS + ".xctest")}
         </TestableReference>
         <TestableReference skipped = "NO">
            <BuildableReference BuildableIdentifier = "primary" BlueprintIdentifier = "InspectionCoreTests" BuildableName = "InspectionCoreTests" BlueprintName = "InspectionCoreTests" ReferencedContainer = "container:Packages/InspectionCore"></BuildableReference>
         </TestableReference>
      </Testables>
   </TestAction>
   <LaunchAction buildConfiguration = "Debug" selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB" launchStyle = "0" useCustomWorkingDirectory = "NO" ignoresPersistentStateOnLaunch = "NO" debugDocumentVersioning = "YES" debugServiceExtension = "internal" allowLocationSimulation = "YES">
      <BuildableProductRunnable runnableDebuggingMode = "0">
         {ref(app_target, APP, APP + ".app")}
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction buildConfiguration = "Release" shouldUseLaunchSchemeArgsEnv = "YES" savedToolIdentifier = "" useCustomWorkingDirectory = "NO" debugDocumentVersioning = "YES">
      <BuildableProductRunnable runnableDebuggingMode = "0">
         {ref(app_target, APP, APP + ".app")}
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction buildConfiguration = "Debug"></AnalyzeAction>
   <ArchiveAction buildConfiguration = "Release" revealArchiveInOrganizer = "YES"></ArchiveAction>
</Scheme>
'''
with open(os.path.join(proj_dir, "xcshareddata", "xcschemes", f"{APP}.xcscheme"), "w") as f:
    f.write(scheme)
print(f"Wrote {APP}.xcodeproj with {len(app_sources)} app sources and {len(test_sources)} test sources")
