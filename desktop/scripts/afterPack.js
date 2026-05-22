// afterPack hook: inject custom icon into the Windows exe using resedit.
// This is needed because rcedit fails with "Unable to commit changes" after
// the asar integrity step (which also uses resedit) modifies the PE structure.
// By setting the icon here (before rcedit runs), the icon is already embedded,
// and rcedit's failure doesn't affect it.

const fs = require('fs/promises');
const path = require('path');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const exePath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.exe`
  );

  // Resolve icon path from build config
  const iconConfig = context.packager.platformSpecificBuildOptions.icon || 'build/icon.ico';
  const iconPath = path.resolve(context.packager.projectDir, iconConfig);

  try {
    await fs.access(iconPath);
  } catch {
    console.log(`[afterPack] Icon not found at ${iconPath}, skipping icon injection`);
    return;
  }

  console.log(`[afterPack] Injecting icon into ${path.basename(exePath)} using resedit...`);

  const { NtExecutable, NtExecutableResource, Resource, Data } = require('resedit');

  // Read the exe and icon
  const [exeBuffer, icoBuffer] = await Promise.all([
    fs.readFile(exePath),
    fs.readFile(iconPath),
  ]);

  const exe = NtExecutable.from(exeBuffer);
  const res = NtExecutableResource.from(exe);

  // Parse ICO file
  const iconFile = Data.IconFile.from(icoBuffer);

  // Find existing icon group IDs
  const RT_GROUP_ICON = 14;
  let groupId = 1;
  for (const entry of res.entries) {
    if (entry.type === RT_GROUP_ICON) {
      groupId = entry.id;
      break;
    }
  }

  // Use resedit's API to replace icons
  Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    groupId,
    1033, // English language
    iconFile.icons.map((icon) => icon.data)
  );

  // Write back
  res.outputResource(exe);
  await fs.writeFile(exePath, Buffer.from(exe.generate()));

  console.log(`[afterPack] Icon injected successfully (${iconFile.icons.length} sizes)`);
};
