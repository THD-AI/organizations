# THD student organizations

The public registry of student groups at THD Deggendorf that host gatherings
in [THD Room Finder](https://github.com/arudaev/THD-Room-Finder). A verified
group can set a gathering in a room THD approved for it: a game night, a
talk, a club meeting or a big group focus session. Students reply Going,
Maybe or Can't from one link.

Groups register themselves. Nobody here creates an organization for someone
else, and verification is never sold.

## Register your group

1. In THD Room Finder, open **Profile → Register your group**. Fill in the
   group's public details. The app gives you a request number and opens the
   form below with it.
2. In the form, say what your role in the group is and give **one proof that
   you speak for it**:
   - a post or story from the group's official account that names the
     request number,
   - a page on the group's own website that lists you in its board or team,
   - or a confirmation from the student union (StuVe).

   Proof that names the request number is best, because nobody can reuse it.
3. A member of [THD AI](https://github.com/THD-AI) who is not you checks the
   proof and labels the issue. The app shows the same status as the issue.

| Label | Means |
|---|---|
| `registry: waiting for proof` | The request is in, the proof is missing |
| `registry: in review` | Proof given; a THD AI member will look at it |
| `registry: needs info` | Something is missing; the comment says what |
| `registry: approved` | Verified. The group can host gatherings |
| `registry: declined` | Not verified; the comment says why |
| `registry: revoked` | No longer verified; open gatherings close |

Approved groups get a file in [`orgs/`](orgs) with their public details.
That file is the public record; the app keeps a copy.

## Rooms

A gathering needs THD's approval for the room at that time. The app records
your approval reference and shows "room approved by THD"; it never books a
room.

## Privacy

Issues here are public. Put only the group's public details in them: no
student emails, phone numbers or private messages. Replying to a gathering
in the app shares a student's name, programme and batch with that group's
organizers, and the app says so before they reply.

## Report a gathering

Something misleading or misused? Open a **Report a gathering** issue with the
gathering's link. No personal data.

## Support links

Each group may list its own support link (GitHub Sponsors, Buy Me a Coffee,
a club account) on its page. Support goes to that group only; the app and
THD AI take no share.
