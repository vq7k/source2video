# skill: delegate-worker

> 当前 source2video 未启用常驻 Worker。

## 何时用

暂不使用。当前项目是单 Engineer 架构，临时并行只用当前 runtime 的 SubAgent / explorer，不建立持久 Worker 状态。

## 启用条件

当 `doc-maker` / `video-maker` / `tts-maker` 中至少一个形成持续独立领域，并满足 `.skill/init-agent-teams/SKILL.md` 的裂变四判据后，先重写本文件，再启用。

## 当前规则

- 不写 `<worker>/.agents/TODO.md`
- 不创建子项目 Worker SOUL
- 不把一次性 SubAgent 当常驻 Worker
