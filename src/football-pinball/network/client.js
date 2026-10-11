/** Ordered HTTP input and streamed authoritative snapshots; never database frame polling. */
export async function createRemoteMatch({
  base,
  joinId,
  mode,
  call,
  ...options
}) {
  base = base.replace(/\/$/, "");
  let token,
    id,
    team,
    latest,
    stream,
    sequence = 0,
    chain = Promise.resolve(),
    error = null,
    closed = false,
    frames = [];
  async function request(path, body) {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok)
      throw Error(data.error || `Server returned ${response.status}`);
    return data;
  }
  const created = await request(
    joinId
      ? `/api/sessions/${encodeURIComponent(joinId)}/join`
      : "/api/sessions",
    joinId ? {} : { mode, ...options },
  );
  ({ id, token, team } = created);
  latest = created.snapshot;
  stream = new EventSource(
    `${base}/api/sessions/${id}/events?token=${encodeURIComponent(token)}`,
  );
  stream.addEventListener("snapshot", (event) => {
    latest = JSON.parse(event.data);
    frames.push({ at: performance.now(), state: latest.state });
    frames = frames.slice(-8);
    error = null;
  });
  stream.onerror = () => {
    error = "Connection interrupted. Reconnecting…";
  };
  function command(c) {
    if (closed) return false;
    chain = chain.then(async () => {
      if (closed) return;
      try {
        const result = await request(`/api/sessions/${id}/commands`, {
          seq: sequence + 1,
          ...c,
        });
        sequence = result.seq;
      } catch (e) {
        error = e.message;
        try {
          const current = await request(`/api/sessions/${id}`);
          sequence = current.commandSequence;
          latest = current;
        } catch {
          /* Reconnection keeps the last confirmed sequence until the service is reachable. */
        }
      }
    });
    return true;
  }
  return {
    id,
    team,
    authority: "server",
    get state() {
      return latest.state.state;
    },
    get paused() {
      return latest.state.paused;
    },
    get error() {
      return error;
    },
    get waiting() {
      return options.opponent === "human" && latest.participants.length < 2;
    },
    command(c) {
      if (c.type === "flip") return this.setInput(c.id, c.pressed);
      return command(c);
    },
    setInput(id, pressed) {
      const s = latest.state,
        b = s.boots.find((b) => b.id === id);
      if (!b || b.team !== team) return false;
      const near = s.defendingEnd[team] === "near";
      return command({
        type: "input",
        control: b.x < 0 === near ? "left" : "right",
        pressed,
      });
    },
    releaseInputs() {
      command({ type: "input", control: "left", pressed: false });
      command({ type: "input", control: "right", pressed: false });
    },
    setPaused(value) {
      return command({ type: value ? "pause" : "resume" });
    },
    advance() {},
    snapshot() {
      return latest.state;
    },
    renderSnapshot() {
      const s = structuredClone(latest.state),
        now = performance.now() - 75;
      let a, b;
      for (let i = 1; i < frames.length; i++)
        if (frames[i - 1].at <= now && frames[i].at >= now) {
          a = frames[i - 1];
          b = frames[i];
          break;
        }
      if (a && b && a.state.state === s.state) {
        const t = (now - a.at) / (b.at - a.at);
        for (const key of ["balls", "boots", "keepers"])
          for (const item of s[key]) {
            const first = a.state[key].find((v) => v.id === item.id),
              second = b.state[key].find((v) => v.id === item.id);
            if (first && second)
              for (const axis of ["x", "y", "height", "angle"])
                if (
                  Number.isFinite(first[axis]) &&
                  Number.isFinite(second[axis])
                )
                  item[axis] = first[axis] + (second[axis] - first[axis]) * t;
          }
      }
      return s;
    },
    async verificationBundle() {
      const [envelope, replay, key] = await Promise.all([
        request(`/api/sessions/${id}/result`),
        request(`/api/sessions/${id}/replay`),
        request("/api/public-key"),
      ]);
      return { envelope, replay, publicKey: key.publicKey };
    },
    signedResult: () => request(`/api/sessions/${id}/result`),
    exportReplay: () => request(`/api/sessions/${id}/replay`),
    dispose() {
      closed = true;
      stream.close();
    },
  };
}
