export const data = {
  code: "SUCCESS",
  message: "Document is fetched successfully",
  data: {
    id: 1062,
    name: "DND-00711",
    description: "",
    projectId: 1,
    active: 1,
    locked: 0,
    members: {
      owner: [
        {
          user: {
            id: 2,
            name: "Anshul Mohabanshi",
            email: "AMohaban@its.jnj.com",
          },
          role: {
            id: 1,
            name: "Owner",
          },
        },
      ],
      contributor: [
        {
          user: {
            id: 1,
            name: "DEV User",
            email: "noreply@its.jnj.com",
          },
          role: {
            id: 2,
            name: "Contributor",
          },
        },
      ],
      reviewer: [
        {
          user: {
            id: 2,
            name: "Anshul Mohabanshi",
            email: "AMohaban@its.jnj.com",
          },
          role: {
            id: 3,
            name: "Reviewer",
          },
        },
      ],
      reader: [],
    },
    type: {
      id: 4,
      name: "Dummy",
    },
    tags: [],
    version: {
      id: 1601,
      version: "1",
      status: "Internal Approved",
      is_locked: 0,
      createdBy: {
        id: 2,
        name: "Anshul",
        time: "2026-03-23T06:27:32.379Z",
      },
    },
    comments: {
      authorComment: [
        {
          comment: "I am sending this doc to review",
          status: "APPROVED",
          time: "2026-03-23T06:36:50.016Z",
          user: {
            id: 2,
            name: "Anshul Mohabanshi",
            email: "AMohaban@its.jnj.com",
          },
        },
      ],
      reviewerComment: [
        {
          comment: "Approving this doc",
          time: "2026-03-23T06:37:13.014Z",
          user: {
            id: 2,
            name: "Anshul Mohabanshi",
            email: "AMohaban@its.jnj.com",
          },
        },
      ],
    },
    accessibleVersionDetail: [
      {
        id: 1601,
        name: "1",
      },
    ],
    sections: [
      {
        id: 8001,
        title: "Radiology Report",
        order: 1,
        status: "DRAFT",
        content: {
          id: 9001,
          data: "<p>Figure 1: Full resolution MRI scan of the patient showing cross-sectional view of the thoracic region.<header><h1>Complex HTML Example</h1><nav>    <ul><li><a href='#lists'>Lists</a></li><li><a href='#table'>Table</a></li><li><a href='#form'>Form</a></li></ul></nav></header><main><section id='formatting'><h2>Text Formatting</h2><p><b>Bold</b>, <strong>Strong</strong>, <i>Italic</i>, <em>Emphasis</em>, <mark>Marked</mark>, <small>Small</small>,  <del>Deleted</del>, <ins>Inserted</ins>,      H<sub>2</sub>O, x<sup>2</sup></p><blockquote cite='https://example.com'> This is a blockquote example.</blockquote>    <pre>function hello() {   console.log('Hello World');} </pre> <code>let x = 10;</code>  <br> <kbd>Ctrl + C</kbd> </section><section id='lists'>  <h2>Nested Lists</h2>  <ul> <li>Fruits  <ul> <li>Apple</li> <li>Banana <ol><li>Ripe</li><li>Unripe</li></ol></li></ul></li><li>Vegetables</li></ul><ol><li>Step 1</li><li>Step 2<ul><li>Substep A</li><li>Substep B</li></ul></li></ol><dl><dt>HTML</dt><dd>HyperText  Language</dd><dt>CSS</dt><dd>Styling language</dd></dl></section><section id='table'><h2>Complex Table</h2><table><caption>Student Data</caption><thead><tr><th rowspan='2'>Name</th><th colspan='2'>Subjects</th><th rowspan='2'>Total</th></tr><tr><th>Math</th><th>Science</th></tr></thead><tbody><tr><td>Alice</td><td>90</td><td>85</td><td>175</td></tr><tr><td>Bob</td><td>80</td><td>88</td><td>168</td></tr></tbody><tfoot><tr><td colspan='3'>Average</td><td>171.5</td></tr></tfoot></table></section><section id='media'><h2>Media Elements</h2><img src='https://via.placeholder.com/150' alt='Sample Image'><audio controls><source src='sample.mp3' type='audio/mpeg'></audio><video width='320' height='240' controls><source src='sample.mp4' type='video/mp4'></video></section><section id='form'><h2>Form Example</h2><form action='#' method='post'><fieldset><legend>Personal Info</legend><label>Name:</label><input type='text' name='name' required><br><br><label>Email:</label><input type='email' name='email'><br><br><label>Password:</label><input type='password'><br><br><label>Gender:</label><input type='radio' name='gender'> Male<input type='radio' name='gender'> Female<br><br><label>Hobbies:</label><input type='checkbox'> Reading<input type='checkbox'> Coding<br><br><label>Country:</label><select><optgroup label='Asia'><option>India</option><option>Japan</option></optgroup><optgroup label='Europe'><option>Germany</option></optgroup></select><br><br><label>Message:</label><br><textarea rows='4' cols='30'></textarea><br><br><label>Upload File:</label><input type='file'><br><br><input type='submit' value='Submit'></fieldset></form></section><section><h2>Interactive & Misc</h2><details><summary>Click to expand</summary><p>This is hidden content.</p></details><progress value='70' max='100'></progress><br><meter value='0.6'>60%</meter><p>Time: <time datetime='2026-03-26'>March 26, 2026</time></p></section></main><aside><h3>Sidebar</h3><p>This is an aside section.</p></aside><footer><p>&copy; 2026 My Website</p></footer></p>",
        },
        members: {
          owner: [
            {
              user: {
                id: 1,
                name: "Dr. Smith",
                email: "smith@hospital.com",
              },
              role: {
                id: 1,
                name: "Owner",
              },
            },
          ],
          contributor: [],
          reviewer: [
            {
              user: {
                id: 2,
                name: "Dr. Jones",
                email: "jones@hospital.com",
              },
              role: {
                id: 3,
                name: "Reviewer",
              },
            },
          ],
        },
        comments: {
          editorComment: {
            ownerComments: [
              {
                comment: "Please review the MRI findings carefully.",
                user: {
                  id: 1,
                  firstName: "Dr.",
                  lastName: "Smith",
                  email: "smith@hospital.com",
                },
                time: "2026-03-23T09:00:00Z",
              },
            ],
            contributorComments: [],
          },
          reviewerComment: [],
          ownerReviewComment: [],
        },
      },
    ],
    access: {
      read: true,
      edit: true,
      delete: true,
      review: true,
      docId: 1062,
      versionId: 1601,
    },
  },
};
