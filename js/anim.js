function createAnim(clips, name) {
  return {
    clips: clips,
    name: name,
    index: 0,
    elapsed: 0,
  };
}

function playClip(anim, name) {
  if (anim.name === name) {
    return;
  }
  anim.name = name;
  anim.index = 0;
  anim.elapsed = 0;
}

function updateAnim(anim, dt) {
  const clip = anim.clips[anim.name];
  if (!clip || clip.frames.length === 0) {
    return;
  }
  anim.elapsed += dt;
  const frameTime = 1 / clip.fps;
  while (anim.elapsed >= frameTime) {
    anim.elapsed -= frameTime;
    anim.index += 1;
    if (anim.index >= clip.frames.length) {
      anim.index = clip.loop ? 0 : clip.frames.length - 1;
    }
  }
}

function currentFrame(anim) {
  const clip = anim.clips[anim.name];
  if (!clip || clip.frames.length === 0) {
    return null;
  }
  const last = clip.frames.length - 1;
  return clip.frames[Math.min(anim.index, last)];
}
